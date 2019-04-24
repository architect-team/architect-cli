import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import {ChildProcess, spawn} from 'child_process';
import * as path from 'path';
import * as readline from 'readline';

import DeploymentConfig from '../common/deployment-config';
import PortUtil from '../common/port-util';
import ServiceConfig from '../common/service-config';

const _info = chalk.blue;
const _success = chalk.green;
const _error = chalk.red;

export default class Start extends Command {
  static description = 'Start the service locally';

  static flags = {
    help: flags.help({char: 'h'}),
    config_path: flags.string({
      char: 'c',
      description: 'Path to a config file containing locations of ' +
        'each service in the application'
    })
  };

  deployment_config: DeploymentConfig = {};

  async run() {
    // Ensures that the python launcher doesn't buffer output and cause hanging
    process.env.PYTHONUNBUFFERED = 'true';
    process.env.PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION = 'python';

    const service_path = process.cwd();
    await this.startService(service_path, true);
    this.exit();
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

  async startService(
    service_path: string,
    is_root_service = false
  ): Promise<void> {
    const service_config = ServiceConfig.loadFromPath(service_path);
    const dependency_names = Object.keys(service_config.dependencies);
    for (let dependency_name of dependency_names) {
      const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(
        service_config.dependencies[dependency_name]
      );
      await this.startService(dependency_path);
    }

    const isServiceRunning = await this.isServiceRunning(service_config.name);
    if (isServiceRunning) {
      this.log(`${_info(service_config.name)} already deployed`);
      return;
    }

    this.log(`Deploying ${_info(service_config.name)}`);
    await this.executeLauncher(service_path, service_config, is_root_service);
  }

  async executeLauncher(
    service_path: string,
    service_config: ServiceConfig,
    is_root_service = false,
  ): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        const cmd_path = path.join(
          __dirname,
          '../../node_modules/.bin/',
          `architect-${service_config.language}-launcher`
        );
        const target_port = await PortUtil.getAvailablePort();
        const cmd_args = [
          '--target_port', `${target_port}`,
          '--service_path', service_path,
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
