import { flags } from '@oclif/command';
import chalk from 'chalk';
import { ChildProcess, spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import Listr from 'listr';
import readline from 'readline';
import untildify from 'untildify';

import Command from '../base';
import DeploymentConfig from '../common/deployment-config';
import PortUtil from '../common/port-util';
import ServiceConfig from '../common/service-config';
import ServiceDependency from '../common/service-dependency';

import Build from './build';

const _info = chalk.blue;
const _success = chalk.green;
const _error = chalk.red;

export default class Deploy extends Command {
  static description = 'Deploy service to environments';

  static args = [
    { name: 'service', description: 'Service name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    environment: flags.string({ exclusive: ['local'] }),
    plan_id: flags.string({ exclusive: ['local'] }),
    local: flags.boolean({ char: 'l', exclusive: ['environment, plan_id'] }),
    env: flags.string({ char: 'e', multiple: true }),
    env_file: flags.string()
  };

  deployment_config: DeploymentConfig = {};
  envs: { [key: string]: string } = {};

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
    let envs = {};
    if (flags.env_file) {
      const envs_buffer = await fs.readFile(untildify(flags.env_file));
      envs = { ...envs, ...dotenv.parse(envs_buffer) };
    }
    for (const env of flags.env || []) {
      envs = { ...envs, ...dotenv.parse(env) };
    }
    return envs;
  }

  async set_envs(root_service: ServiceDependency) {
    const envs = await this.get_envs();

    const errors = [];
    for (const dependency of root_service.all_dependencies) {
      if (Object.keys(dependency.config.envs).length === 0) continue;

      const missing_envs = [];
      for (const [key, env] of Object.entries(dependency.config.envs)) {
        if (env.required) {
          const scoped_key = `ARC_${dependency.config.getNormalizedName().toUpperCase()}__${key}`;
          if (!(key in envs) && !(scoped_key in envs)) {
            missing_envs.push(key);
          }
        }
      }

      if (missing_envs.length) {
        errors.push(`${_info(dependency.config.full_name)} requires the following envs: ${missing_envs.join(', ')}`);
      }
    }
    if (errors.length) {
      this.error(errors.join('\n'));
    }
    this.envs = envs;
  }

  async run_local() {
    const { args } = this.parse(Deploy);
    let root_service_path = args.service ? args.service : process.cwd();
    await Build.run([root_service_path, '-r']);

    const root_service = ServiceDependency.create(this.app_config, root_service_path);

    await this.set_envs(root_service);

    const tasks: Listr.ListrTask[] = [];
    for (const dependency of root_service.all_dependencies) {
      tasks.push({
        title: `Deploying ${_info(dependency.config.name)}`,
        task: async () => {
          const isServiceRunning = await this.isServiceRunning(dependency.config.full_name);
          if (isServiceRunning) {
            this.log(`${_info(dependency.config.full_name)} already deployed`);
            return;
          }
          await this.executeLauncher(dependency);
        }
      });
    }

    await new Listr(await tasks, { renderer: 'verbose' }).run();
  }

  async isServiceRunning(service_name: string) {
    if (Object.keys(this.deployment_config).includes(service_name)) {
      const instance_details = this.deployment_config[service_name];
      const port_check = await PortUtil.isPortAvailable(instance_details.port);
      return !!port_check;
    }

    return false;
  }

  setServiceEnvironmentDetails(
    service_config: ServiceConfig,
    child_process: ChildProcess,
    host: string,
    port: number,
    service_path: string,
  ): void {
    const key = `ARCHITECT_${service_config.getNormalizedName().toUpperCase()}`;
    process.env[key] = JSON.stringify({
      host,
      port,
      proto_prefix: service_config.getProtoName()
    });
    this.deployment_config[service_config.full_name] = {
      host,
      port,
      service_path,
      env_key: key,
      proto_prefix: service_config.getProtoName(),
      process: child_process,
    };
  }

  async executeLauncher(service: ServiceDependency): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const target_port = await PortUtil.getAvailablePort();

        const envs: string[] = [];

        for (const [key, env] of Object.entries(service.config.envs)) {
          const scoped_key = `ARC_${service.config.getNormalizedName().toUpperCase()}__${key}`;
          const value = this.envs[scoped_key] || this.envs[key] || env.default;
          if (value !== undefined) {
            envs.push('--env');
            envs.push(`${key}=${value}`);
          }
        }

        Object.values(this.deployment_config).forEach(deployment_config => {
          envs.push('--env');
          const env = deployment_config.env_key;
          const env_value = JSON.parse(process.env[deployment_config.env_key]!);
          env_value.host = 'host.docker.internal';
          envs.push(`${env}=${JSON.stringify(env_value)}`);
        });

        const cmd_args = [
          'run',
          '-p', `${target_port}:8080`,
          '--rm', '--init',
          ...envs,
          service.tag
        ];
        const cmd = spawn('docker', cmd_args);

        let host: string;
        readline.createInterface({
          input: cmd.stdout,
          terminal: false
        }).on('line', data => {
          data = data.trim();
          if (service.config.isScript() && data.length > 0) {
            this.log(_success(data));
          } else {
            if (data.indexOf('Host: ') === 0) {
              host = data.substring(6);
              this.log(`Running on ${host}:${target_port}`);
              this.setServiceEnvironmentDetails(service.config, cmd, host, target_port, service.service_path);
              resolve();
            } else if (data.length > 0 && data.indexOf('Port: ') !== 0) {
              this.log(_info(`[${service.config.name}]`), data);
            }
          }
        });

        readline.createInterface({
          input: cmd.stderr,
          terminal: false
        }).on('line', data => {
          data = data.trim();
          if (data.length > 0) {
            if (service.config.isScript()) {
              this.log(_error(data));
            } else {
              this.log(_info(`[${service.config.name}]`), _error(data));
            }
          }
        });

        cmd.on('close', code => {
          if (code === 1) {
            this.log(_error(`Error executing architect-${service.config.language}-launcher`));
            reject(new ServiceLaunchError(service.config.name));
          } else {
            resolve();
          }
          Object.values(this.deployment_config).forEach(config => config.process.kill());
        });

        cmd.on('error', error => {
          this.log(_error(`Error: spawning architect-${service.config.language}-launcher`));
          this.log(_error(error.toString()));
          Object.values(this.deployment_config).forEach(config => config.process.kill());
          reject(error);
        });
      } catch (error) {
        Object.values(this.deployment_config).forEach(config => config.process.kill());
        reject(error);
      }
    });
  }

  async run_external() {
    const answers = await this.promptOptions();

    if (answers.plan_id) {
      await this.deploy(answers.environment!, answers.plan_id);
    } else {
      let plan: any;
      const tasks = new Listr([
        {
          title: `Planning`,
          task: async () => {
            const envs = await this.get_envs();
            const data = {
              service: `${answers.service_name}:${answers.service_version}`,
              envs
            };
            const { data: res } = await this.architect.post(`/environments/${answers.environment}/services`, { data });
            plan = res;
          }
        }
      ]);
      await tasks.run();
      this.log(plan.plan_info);
      this.log('Plan Id:', plan.plan_id);

      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to deploy this plan?'
      } as inquirer.Question);

      if (confirmation.deploy) {
        await this.deploy(answers.environment!, plan.plan_id);
      } else {
        this.warn('Canceled deploy');
      }
    }
  }

  async deploy(environment: string, plan_id: string) {
    const tasks = new Listr([
      {
        title: `Deploying`,
        task: async () => {
          const params = { plan_id };
          await this.architect.post(`/environments/${environment}/deploy`, { params });
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
      plan_id: flags.plan_id
    };

    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'service_name',
      message: 'Select service:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: services } = await this.architect.get('/repositories', { params });
        return services.map((service: any) => service.name);
      },
      when: !service_name && !flags.plan_id
    } as inquirer.Question, {
      type: 'list',
      name: 'service_version',
      message: 'Select version:',
      choices: async (answers_so_far: any) => {
        const { data: service } = await this.architect.get(`/repositories/${answers_so_far.service_name || service_name}`);
        return service.tags;
      },
      when: !service_version && !flags.plan_id
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
class ServiceLaunchError extends Error {
  constructor(service_name: string) {
    super(`Failed to start the service: ${service_name}`);
  }
}
