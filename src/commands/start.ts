import { flags } from '@oclif/command';
import chalk from 'chalk';
import { ChildProcess, spawn } from 'child_process';
import * as Listr from 'listr';
import * as path from 'path';
import * as readline from 'readline';
import * as url from 'url';

import Command from '../base';
import DeploymentConfig from '../common/deployment-config';
import PortUtil from '../common/port-util';
import ServiceConfig from '../common/service-config';
import ServiceDependency from '../common/service-dependency';

import Install from './install';

const _info = chalk.blue;
const _success = chalk.green;
const _error = chalk.red;

export default class Start extends Command {
  static description = 'Start the service locally';

  static flags = {
    help: flags.help({ char: 'h' })
  };

  static args = [
    {
      name: 'context',
      description: 'Path to the service to build'
    }
  ];

  deployment_config: DeploymentConfig = {};

  async run() {
    // Ensures that the python launcher doesn't buffer output and cause hanging
    process.env.PYTHONUNBUFFERED = 'true';
    process.env.PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION = 'python';

    const tasks = new Listr(await this.tasks(), { renderer: 'verbose' });
    await tasks.run();
  }

  async tasks(): Promise<Listr.ListrTask[]> {
    const { args } = this.parse(Start);
    let root_service_path = process.cwd();
    if (args.context) {
      root_service_path = path.resolve(args.context);
    }

    await Install.run(['-p', root_service_path, '-r', '--only_load']);

    const root_service = ServiceDependency.create(this.app_config, root_service_path);
    const tasks: Listr.ListrTask[] = [];
    root_service.all_dependencies.forEach(dependency => {
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
    });
    return tasks;
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
      proto_prefix: service_config.getProtoName(),
      process: child_process,
    };
  }

  async executeLauncher(service: ServiceDependency): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const ext = process.platform === 'win32' ? '.cmd' : '';

        let cmd_path: string;
        let cmd_args: any;
        const target_port = await PortUtil.getAvailablePort();
        if (service.local) {
          cmd_path = path.join(
            __dirname,
            '../../node_modules/.bin/',
            `architect-${service.config.language}-launcher${ext}`
          );
          cmd_args = [
            '--target_port', `${target_port}`,
            '--service_path', service.service_path
          ];
        } else {
          cmd_path = 'docker';
          const repository_name = url.resolve(`${this.app_config.default_registry_host}/`, `${service.service_path}`);
          cmd_args = [
            'run',
            '-p', `${target_port}:8080`,
            '--rm', '--init',
            '--name', service.config.full_name.replace(/:/g, '-'),
            repository_name
          ];
        }

        const cmd = spawn(cmd_path, cmd_args);

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
              this.setServiceEnvironmentDetails(service.config, cmd, host, target_port, service.service_path);
              resolve();
            } else if (data.length > 0 && data.indexOf('Port: ') !== 0) {
              this.log(_info(`[${service.config.name}]`), data);
            }
          }
        });

        let hadError = false;
        readline.createInterface({
          input: cmd.stderr,
          terminal: false
        }).on('line', data => {
          hadError = true;
          data = data.trim();
          if (data.length > 0) {
            if (service.config.isScript()) {
              this.log(_error(data));
            } else {
              this.log(_info(`[${service.config.name}]`), _error(data));
            }
          }
        });

        cmd.on('close', () => {
          if (hadError) {
            this.log(_error(`Error executing architect-${service.config.language}-launcher`));
            this.log(_error(`Failed on: ${cmd_path} ${cmd_args.join(' ')}`));
            this.exit(1);
          }
          if (!service.config.isScript()) {
            Object.values(this.deployment_config).forEach(config => config.process.kill());
            return reject(new ServiceLaunchError(service.config.name));
          } else if (service.root) {
            Object.values(this.deployment_config).forEach(config => config.process.kill());
          }

          resolve();
        });

        cmd.on('error', error => {
          this.log(_error(`Error: spawning architect-${service.config.language}-launcher`));
          this.log(_error(error.toString()));

          if (!service.config.isScript()) {
            Object.values(this.deployment_config).forEach(config => config.process.kill());
            return reject(new ServiceLaunchError(service.config.name));
          } else if (service.root) {
            Object.values(this.deployment_config).forEach(config => config.process.kill());
          }

          reject(error);
        });
      } catch (error) {
        if (!service.config.isScript()) {
          Object.values(this.deployment_config).forEach(config => config.process.kill());
          return reject(new ServiceLaunchError(service.config.name));
        } else if (service.root) {
          Object.values(this.deployment_config).forEach(config => config.process.kill());
        }

        reject(error);
      }
    });
  }
}

class ServiceLaunchError extends Error {
  constructor(service_name: string) {
    super(`Failed to start the service: ${service_name}`);
  }
}
