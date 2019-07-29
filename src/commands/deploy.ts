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

  validate_envs(root_service: ServiceDependency, envs: { [key: string]: string }) {
    const errors = [];
    for (const dependency of root_service.all_dependencies) {
      if (Object.keys(dependency.config.parameters).length === 0) continue;

      const missing_envs = [];
      for (const [key, env] of Object.entries(dependency.config.parameters)) {
        if (env.required) {
          const scoped_key = `ARC_${dependency.config.getNormalizedName().toUpperCase()}__${key}`;
          if (!(key in envs) && !(scoped_key in envs)) {
            missing_envs.push(key);
          }
        }
      }

      if (missing_envs.length) {
        errors.push(`${_info(dependency.config.full_name)} requires the following parameters: ${missing_envs.join(', ')}`);
      }
    }
    if (errors.length) {
      this.error(errors.join('\n'));
    }
  }

  async run_local() {
    const { args } = this.parse(Deploy);
    let root_service_path = args.service ? args.service : process.cwd();
    await Install.run(['-p', root_service_path, '-r']);

    const root_service = ServiceDependency.create(this.app_config, root_service_path);

    const envs = await this.get_envs();
    this.validate_envs(root_service, envs);

    const docker_compose: any = {
      version: '3',
      services: {},
      volumes: {}
    };

    const datastore_defaults: { [key: string]: any } = {
      mysql: { port: 3306, username: 'root', password: '' },
      postgres: { port: 5432, username: 'postgres', name: 'postgres' }
    };

    for (const service of root_service.all_dependencies) {
      const service_host = service.config.full_name.replace(/:/g, '_').replace(/\//g, '__');
      const port = '8080';
      const target_port = await PortUtil.getAvailablePort();

      const environment: { [key: string]: string | number | undefined } = {
        HOST: service_host,
        PORT: port,
        ARC_CURRENT_SERVICE: service.config.name
      };

      const depends_on = [];
      for (const [name, datastore] of Object.entries(service.config.datastores)) {
        const datastore_host = `${service_host}.datastore.${name}.${datastore.type}.${datastore.version}`;
        const db_port = await PortUtil.getAvailablePort();

        docker_compose.services[datastore_host] = {
          image: `${datastore.type}:${datastore.version}`,
          restart: 'always',
          ports: [`${db_port}:${datastore_defaults[datastore.type].port}`],
        };
        depends_on.push(datastore_host);

        environment[`ARC_DS_${name.replace('-', '_').toUpperCase()}`] = JSON.stringify({
          host: datastore_host,
          interface: datastore.type,
          ...datastore_defaults[datastore.type]
        });
      }

      for (const [key, env] of Object.entries(service.config.parameters)) {
        const scoped_key = `ARC_${service.config.getNormalizedName().toUpperCase()}__${key}`;
        const value = envs[scoped_key] || envs[key] || env.default;
        if (value !== undefined && value !== null) {
          environment[key] = value;
        }
      }

      for (const dependency of service.dependencies.concat([service])) {
        const dependency_name = dependency.config.full_name.replace(/:/g, '_').replace(/\//g, '__');
        environment[`ARC_${dependency.config.getNormalizedName().toUpperCase()}`] = JSON.stringify({
          host: dependency_name,
          port,
          interface: dependency.config.interface && dependency.config.interface.type
        });
        if (service !== dependency) {
          depends_on.push(dependency_name);
        }
      }

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
