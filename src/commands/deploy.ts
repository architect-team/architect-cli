import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import Listr from 'listr';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import Command from '../base';
import { EnvironmentMetadata } from '../common/environment-metadata';
import PortUtil from '../common/port-util';
import ServiceDependency from '../common/service-dependency';
import Install from './install';

const _info = chalk.blue;

export default class Deploy extends Command {
  static description = 'Deploy service to environments';

  static args = [
    { name: 'service', description: 'Service name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    environment: flags.string({ exclusive: ['local'] }),
    deployment_id: flags.string({ exclusive: ['local'] }),
    local: flags.boolean({ char: 'l', exclusive: ['environment, deployment_id'] }),
    services: flags.string({ char: 's', exclusive: ['environment, deployment_id'], multiple: true }),
    config_file: flags.string()
  };

  async run() {
    const { flags } = this.parse(Deploy);
    if (flags.local) {
      await this.run_local();
    } else {
      await this.run_external();
    }
  }

  validate_parameters(root_service: ServiceDependency, config_json: any) {
    const res = JSON.parse(JSON.stringify(config_json));
    res.services = res.services || {};
    const errors = [];
    for (const service of root_service.all_dependencies) {
      const service_override = res.services[service.config.full_name] || { parameters: {} };
      for (const [key, parameter] of Object.entries(service.config.parameters)) {
        if (parameter.default === undefined) {
          service_override.parameters[key] = `<${key}>`;
          errors.push(`${service.config.full_name}.parameters.${key}`);
        }
      }

      service_override.datastores = service_override.datastores || {};
      for (const [ds_key, datastore] of Object.entries(service.config.datastores)) {
        const datastore_override = service_override.datastores[ds_key] = service_override.datastores[ds_key] || { parameters: {} };
        for (const [key, parameter] of Object.entries(datastore.parameters || {})) {
          if (parameter.default === undefined) {
            datastore_override.parameters[key] = `<${key}>`;
            errors.push(`${service.config.full_name}.datastores.${ds_key}.parameters.${key}`);
          }
        }
      }
      res.services[service.config.full_name] = service_override;
    }
    if (errors.length) {
      this.log(JSON.stringify(res, null, 2));
      this.error('Missing the following required parameters:\n' + errors.join('\n'));
    }
  }

  async read_parameter(value: string) {
    if (value.startsWith('file:')) {
      return fs.readFile(untildify(value.slice('file:'.length)), 'utf-8');
    } else {
      return value;
    }
  }

  async parse_config() {
    const { flags } = this.parse(Deploy);
    let config_json: EnvironmentMetadata = { services: {} };
    if (flags.config_file) {
      config_json = await fs.readJSON(untildify(flags.config_file));
      config_json.services = config_json.services || {};
      for (const service of Object.values(config_json.services)) {
        for (const [key, value] of Object.entries(service.parameters || {})) {
          service.parameters![key] = await this.read_parameter(value);
        }
        for (const datastore of Object.values(service.datastores || {})) {
          for (const [key, value] of Object.entries(datastore.parameters || {})) {
            datastore.parameters![key] = await this.read_parameter(value);
          }
        }
      }
    }
    return config_json;
  }

  async run_local() {
    const { args, flags } = this.parse(Deploy);

    const docker_compose: any = {
      version: '3',
      services: {},
      volumes: {}
    };

    const service_paths = flags.services || [
      args.service ? args.service : process.cwd()
    ];

    const dependencies_map: { [key: string]: ServiceDependency } = {};
    const subscriptions_map: any = {};
    const optional_dependencies_map: { [key: string]: ServiceDependency[] } = {};

    for (const svc_path of service_paths) {
      await Install.run(['-p', svc_path, '-r']);
      const svc = ServiceDependency.create(this.app_config, svc_path);
      const config_json = await this.parse_config();
      svc.override_configs(config_json);
      this.validate_parameters(svc, config_json);

      for (const service of svc.all_dependencies) {
        dependencies_map[service.config.name] = service;

        if (!subscriptions_map[service.config.name]) {
          subscriptions_map[service.config.name] = {};
        }
        for (const event of service.config.notifications) {
          subscriptions_map[service.config.name][event] = {};
        }

        if (service.config.subscriptions) {
          for (const [service_name, events] of Object.entries(service.config.subscriptions)) {
            if (!optional_dependencies_map[service_name]) {
              optional_dependencies_map[service_name] = [];
            }
            optional_dependencies_map[service_name].push(dependencies_map[service.config.name]);

            for (const [event_name, event_config] of Object.entries(events)) {
              if (!subscriptions_map[service_name]) {
                subscriptions_map[service_name] = {};
              }
              if (!subscriptions_map[service_name][event_name]) {
                subscriptions_map[service_name][event_name] = {};
              }
              subscriptions_map[service_name][event_name][service.config.name] = event_config;
            }
          }
        }
      }
    }

    const target_port_map: any = {};
    const service_port = async (service_name: string) => {
      if (!(service_name in target_port_map)) {
        target_port_map[service_name] = await PortUtil.getAvailablePort();
        this.log(_info(service_name), `0.0.0.0:${target_port_map[service_name]}`);
      }
      return target_port_map[service_name];
    };

    for (const service of Object.values(dependencies_map)) {
      const service_host = service.config.full_name.replace(/:/g, '-').replace(/\//g, '--');

      const architect: any = {};
      const depends_on = [];

      const dependencies: Set<ServiceDependency> = new Set();
      dependencies.add(service);
      const optional_dependencies = optional_dependencies_map[service.config.name] || [];
      for (const dependency of service.dependencies.concat(optional_dependencies)) {
        dependencies.add(dependency);
      }

      for (const dependency of dependencies) {
        const dependency_name = dependency.config.full_name.replace(/:/g, '-').replace(/\//g, '--');
        const api_type = dependency.config.api && dependency.config.api.type;
        let dependency_host;
        if (dependency.config.host) {
          dependency_host = dependency.config.host;
        } else if (api_type === 'grpc') {
          dependency_host = 'host.docker.internal';
        } else {
          // tslint:disable-next-line: no-http-string
          dependency_host = 'http://host.docker.internal';
        }
        architect[dependency.config.name] = {
          host: dependency_host,
          port: dependency.config.host ? dependency.config.port : await service_port(dependency.config.name),
          api: api_type
        };
        if (service === dependency) {
          architect[dependency.config.name].subscriptions = subscriptions_map[dependency.config.name] || {};
        } else if (service.dependencies.indexOf(dependency) >= 0 && !dependency.config.host) {
          depends_on.push(dependency_name);
        }
      }

      architect[service.config.name].datastores = {};
      for (const [datastore_name, datastore] of Object.entries(service.config.datastores)) {
        const datastore_environment: any = {};
        const datastore_aliases: any = { port: datastore.port };
        for (const [key, parameter] of Object.entries(datastore.parameters || {})) {
          datastore_environment[key] = parameter.default!;
          datastore_aliases[key] = parameter.default!;
          if (parameter.alias) {
            datastore_aliases[parameter.alias] = parameter.default!;
          }
        }

        let datastore_host;
        let datastore_port;
        if (datastore.host) {
          datastore_host = datastore.host;
          datastore_port = datastore.port;
        } else {
          const datastore_service_name = `${service_host}.datastore.${datastore_name}.${datastore.image.replace(/:/g, '_')}`;
          datastore_host = 'host.docker.internal';
          datastore_port = await service_port(datastore_service_name);
          docker_compose.services[datastore_service_name] = {
            image: `${datastore.image}`,
            ports: [`${datastore_port}:${datastore.port}`],
            environment: datastore_environment
          };
          depends_on.push(datastore_service_name);
        }

        architect[service.config.name].datastores[datastore_name] = {
          ...datastore_aliases,
          host: datastore_host,
          port: datastore_port
        };
      }

      let environment: { [key: string]: string | number | undefined } = {};
      for (const [key, parameter] of Object.entries(service.config.parameters)) {
        environment[key] = parameter.default!;
      }
      environment = {
        ...environment,
        HOST: service_host,
        PORT: service.config.port,
        ARCHITECT_CURRENT_SERVICE: service.config.name,
        ARCHITECT: JSON.stringify(architect)
      };

      docker_compose.services[service_host] = {
        image: service.tag,
        ports: [`${await service_port(service.config.name)}:${service.config.port}`],
        depends_on,
        environment,
        command: service.config.debug
      };
      if (service.local) {
        docker_compose.services[service_host] = {
          ...docker_compose.services[service_host],
          build: service.service_path,
          volumes: [
            `${service.service_path}/src:/usr/src/app/src:ro`
          ],
        };
      }
    }

    const docker_compose_path = path.join(os.homedir(), '.architect', 'docker-compose.json');
    await fs.ensureFile(docker_compose_path);
    await fs.writeFile(docker_compose_path, JSON.stringify(docker_compose, null, 2));
    await execa('docker-compose', ['-f', docker_compose_path, 'up', '--build'], { stdio: 'inherit' });
  }

  async run_external() {
    const answers = await this.promptOptions();

    if (answers.deployment_id) {
      await this.deploy(answers.deployment_id);
    } else {
      let deployment: any;
      const tasks = new Listr([
        {
          title: `Planning`,
          task: async () => {
            const config_json = await this.parse_config();
            const data = {
              service: `${answers.service_name}:${answers.service_version}`,
              environment: answers.environment,
              config: config_json
            };
            const { data: res } = await this.architect.post(`/deploy`, { data });
            deployment = res;
          }
        }
      ]);
      await tasks.run();
      this.log('Deployment Id:', deployment.id);

      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to apply this deployment?'
      } as inquirer.Question);

      if (confirmation.deploy) {
        await this.deploy(deployment.id);
      } else {
        this.warn('Canceled deploy');
      }
    }
  }

  async deploy(deployment_id: string) {
    const tasks = new Listr([
      {
        title: `Deploying`,
        task: async () => {
          await this.architect.post(`/deploy/${deployment_id}`);
        }
      }
    ]);
    await tasks.run();
  }

  async promptOptions() {
    const { args, flags } = this.parse(Deploy);

    const [service_name, service_version] = args.service ? args.service.split(':') : [undefined, undefined];
    let options = {
      service_name,
      service_version,
      environment: flags.environment,
      deployment_id: flags.deployment_id
    };

    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'service_name',
      message: 'Select service:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: services } = await this.architect.get('/services', { params });
        return services.map((service: any) => service.name);
      },
      when: !service_name && !flags.deployment_id
    } as inquirer.Question, {
      type: 'list',
      name: 'service_version',
      message: 'Select version:',
      choices: async (answers_so_far: any) => {
        const { data: service } = await this.architect.get(`/services/${answers_so_far.service_name || service_name}`);
        return service.tags;
      },
      when: !service_version && !flags.deployment_id
    }, {
      type: 'autocomplete',
      name: 'environment',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.architect.get('/environments', { params });
        return environments.map((environment: any) => environment.name);
      },
      when: !flags.environment
    } as inquirer.Question]);

    return { ...options, ...answers };
  }
}
