import { flags } from '@oclif/command';
import chalk from 'chalk';
import dotenv from 'dotenv';
import execa from 'execa';
import fs, { ensureFile, writeFile } from 'fs-extra';
import inquirer from 'inquirer';
import Listr from 'listr';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import Command from '../base';
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
    env: flags.string({ char: 'e', multiple: true }),
    env_file: flags.string()
  };

  async run() {
    const { flags } = this.parse(Deploy);
    if (flags.local) {
      await this.run_local();
    } else {
      await this.run_external();
    }
  }

  async get_envs() {
    const { flags } = this.parse(Deploy);
    let envs: { [key: string]: string } = {};
    if (flags.env_file) {
      const envs_buffer = await fs.readFile(untildify(flags.env_file));
      envs = { ...envs, ...dotenv.parse(envs_buffer) };
    }
    for (const env of flags.env || []) {
      envs = { ...envs, ...dotenv.parse(env) };
    }
    return envs;
  }

  validate_parameters(root_service: ServiceDependency, debug_json: any) {
    const res = { ...debug_json };
    const errors = [];
    for (const service of root_service.all_dependencies) {
      const service_override = res[service.config.full_name] || { parameters: {} };
      for (const [key, parameter] of Object.entries(service.config.parameters)) {
        if (parameter.default === undefined) {
          service_override.parameters[key] = `<${key}>`
          errors.push(`${service.config.full_name}.parameters.${key}`);
        }
      }

      service_override.datastores = service_override.datastores || {};
      for (const [ds_key, datastore] of Object.entries(service.config.datastores)) {
        const datastore_override = service_override.datastores[ds_key] = service_override.datastores[ds_key] || { parameters: {} };
        for (const [key, parameter] of Object.entries(datastore.parameters)) {
          if (parameter.default === undefined) {
            datastore_override.parameters[key] = `<${key}>`
            errors.push(`${service.config.full_name}.datastores.${ds_key}.parameters.${key}`);
          }
        }
      }
      res[service.config.full_name] = service_override;
    }
    if (errors.length) {
      this.log(JSON.stringify(res, null, 2));
      this.error('Missing the following required parameters:\n' + errors.join('\n'));
    }
  }

  async run_local() {
    const { args } = this.parse(Deploy);
    let root_service_path = args.service ? args.service : process.cwd();
    await Install.run(['-p', root_service_path, '-r']);

    const root_service = ServiceDependency.create(this.app_config, root_service_path);

    // TODO
    const debug_json = await fs.readJSON('./architect-debug.json').catch(() => { return {} });
    root_service.override_configs(debug_json);
    this.validate_parameters(root_service, debug_json);

    const docker_compose: any = {
      version: '3',
      services: {},
      volumes: {}
    };

    for (const service of root_service.all_dependencies) {
      const service_host = service.config.full_name.replace(/:/g, '_').replace(/\//g, '__');
      const port = '8080';
      const target_port = await PortUtil.getAvailablePort();

      const architect: any = {};

      const depends_on = [];

      for (const dependency of service.dependencies.concat([service])) {
        const dependency_name = dependency.config.full_name.replace(/:/g, '_').replace(/\//g, '__');
        architect[dependency.config.name] = {
          host: dependency_name,
          port,
          interface: dependency.config.interface && dependency.config.interface.type
        };
        if (service !== dependency) {
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
        if (datastore.host) {
          datastore_host = datastore.host;
        } else {
          datastore_host = `${service_host}.datastore.${datastore_name}.${datastore.image.replace(/:/g, '_')}`;
          const db_port = await PortUtil.getAvailablePort();
          docker_compose.services[datastore_host] = {
            image: `${datastore.image}`,
            restart: 'always',
            ports: [`${db_port}:${datastore.port}`],
            environment: datastore_environment
          };
          depends_on.push(datastore_host);
        }

        architect[service.config.name].datastores[datastore_name] = {
          ...datastore_aliases,
          host: datastore_host,
          port: datastore.port
        }
      }

      let environment: { [key: string]: string | number | undefined } = {};
      for (const [key, parameter] of Object.entries(service.config.parameters)) {
        environment[key] = parameter.default!;
      }
      environment = {
        ...environment,
        HOST: service_host,
        PORT: port,
        ARCHITECT_CURRENT_SERVICE: service.config.name,
        ARCHITECT: JSON.stringify(architect)
      };

      docker_compose.services[service_host] = {
        image: service.tag,
        build: service.service_path,
        ports: [`${target_port}:${port}`],
        depends_on,
        environment,
        command: service.config.debug,
        volumes: [
          `${service.service_path}/src:/usr/src/app/src:ro`
        ]
      };
    }

    const docker_compose_path = path.join(os.homedir(), '.architect', 'docker-compose.json');
    await ensureFile(docker_compose_path);
    await writeFile(docker_compose_path, JSON.stringify(docker_compose, null, 2));
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
            const envs = await this.get_envs();
            const data = {
              service: `${answers.service_name}:${answers.service_version}`,
              environment: answers.environment,
              envs
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
