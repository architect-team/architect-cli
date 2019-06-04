import { flags } from '@oclif/command';
import chalk from 'chalk';
import { ChildProcess, spawn } from 'child_process';
import * as Listr from 'listr';
import * as path from 'path';
import * as readline from 'readline';

import Command from '../base';
import DeploymentConfig from '../common/deployment-config';
import PortUtil from '../common/port-util';
import ServiceConfig from '../common/service-config';

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

    const recursive = true;
    const dependencies = await ServiceConfig.getDependencies(root_service_path, recursive);
    dependencies.reverse();
    const tasks: Listr.ListrTask[] = [];
    dependencies.forEach(dependency => {
      tasks.push({
        title: `Deploying ${_info(dependency.service_config.name)}`,
        task: async () => {
          const isServiceRunning = await this.isServiceRunning(dependency.service_config.name);
          if (isServiceRunning) {
            this.log(`${_info(dependency.service_config.name)} already deployed`);
            return;
          }
          const is_root_service = root_service_path === dependency.service_path;
          await this.executeLauncher(dependency.service_path, dependency.service_config, is_root_service);
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
    this.deployment_config[service_config.name] = {
      host,
      port,
      service_path,
      proto_prefix: service_config.getProtoName(),
      process: child_process,
    };
  }

  async executeLauncher(
    service_path: string,
    service_config: ServiceConfig,
    is_root_service = false,
  ): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const ext = process.platform === 'win32' ? '.cmd' : '';
        const cmd_path = path.join(
          __dirname,
          '../../node_modules/.bin/',
          `architect-${service_config.language}-launcher${ext}`
        );
        const target_port = await PortUtil.getAvailablePort();
        const cmd_args = [
          '--target_port', `${target_port}`,
          '--service_path', service_path
        ];
        const cmd = spawn(cmd_path, cmd_args);

        let host: string;
        let port: number;

        readline.createInterface({
          input: cmd.stdout,
          terminal: false
        }).on('line', data => {
          data = data.trim();
          if (service_config.isScript() && data.length > 0) {
            this.log(_success(data));
          } else {
            if (data.indexOf('Host: ') === 0) {
              host = data.substring(6);
            } else if (data.indexOf('Port: ') === 0) {
              port = data.substring(6);
            } else if (data.length > 0) {
              this.log(_info(`[${service_config.name}]`), data);
            }

            if (host && port) {
              this.setServiceEnvironmentDetails(service_config, cmd, host, port, service_path);
              resolve();
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
            if (service_config.isScript()) {
              this.log(_error(data));
            } else {
              this.log(_info(`[${service_config.name}]`), _error(data));
            }
          }
        });

        cmd.on('close', () => {
          if (hadError) {
            this.log(_error(`Error executing architect-${service_config.language}-launcher`));
            this.log(_error(`Failed on: ${cmd_path} ${cmd_args.join(' ')}`));
            this.exit(1);
          }
          if (!service_config.isScript()) {
            Object.values(this.deployment_config).map(config => config.process.kill());
            return reject(new ServiceLaunchError(service_config.name));
          } else if (is_root_service) {
            Object.values(this.deployment_config).map(config => config.process.kill());
          }

          resolve();
        });

        cmd.on('error', error => {
          this.log(_error(`Error: spawning architect-${service_config.language}-launcher`));
          this.log(_error(error.toString()));
          reject(error);
        });
      } catch (error) {
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
