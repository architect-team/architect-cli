import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import {ChildProcess, spawn} from 'child_process';
import * as net from 'net';
import * as path from 'path';
import * as readline from 'readline';

import DeploymentConfig from '../common/deployment-config';
import ServiceConfig from '../common/service-config';

const AVAILABLE_PORTS = ['50051', '50052', '50053', '50054', '50055'];

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

  static async isPortAvailable(port: string) {
    return new Promise<boolean>(resolve => {
      const tester: net.Server = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () =>
          tester.once('close', () => resolve(true)).close()
        )
        .listen(port);
    });
  }

  static async getAvailablePort() {
    let port;

    for (let p of AVAILABLE_PORTS) {
      const isAvailable = await Start.isPortAvailable(p);
      if (isAvailable) {
        port = p;
        break;
      }
    }

    if (!port) throw new Error('No valid ports available');
    return port;
  }

  deployment_config: DeploymentConfig = {};

  async run() {
    const service_path = process.cwd();
    await this.startService(service_path, true);
    this.exit();
  }

  setServiceEnvironmentDetails(
    service_name: string,
    child_process: ChildProcess,
    host: string,
    port: number,
    service_path: string,
  ): void {
    const key = `ARCHITECT_${service_name.toUpperCase().replace('-', '_')}`;
    const value = {host, port, service_path};
    process.env[key] = JSON.stringify(value);
    this.deployment_config[service_name] = {
      host,
      port,
      service_path,
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

    // Check if the service is already running
    if (Object.keys(this.deployment_config).includes(service_config.name)) {
      const instance_details = this.deployment_config[service_config.name];
      const port_check = await Start.isPortAvailable(`${instance_details.port}`);
      if (!port_check) {
        this.log(`${service_config.name} already deployed at ${instance_details.host}:${instance_details.port}`);
        return;
      }
    }

    this.log(`Deploying ${chalk.blue(service_config.name)}`);
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
        const target_port = await Start.getAvailablePort();
        const cmd = spawn(cmd_path, [
          '--target_port', `${target_port}`,
          '--service_path', service_path,
        ]);

        let host: string;
        let port: number;

        readline.createInterface({
          input: cmd.stdout,
          terminal: false
        }).on('line', data => {
          data = data.trim();
          if (service_config.isScript() && data.length > 0) {
            this.log(data);
          } else {
            if (data.indexOf('Host: ') === 0) {
              host = data.substring(6);
            } else if (data.indexOf('Port: ') === 0) {
              port = data.substring(6);
            }

            if (host && port) {
              this.setServiceEnvironmentDetails(service_config.name, cmd, host, port, service_path);
              resolve();
            }
          }
        });

        cmd.stderr.on('data', data => {
          data = data.toString().trim();
          this.error(data);
        });

        cmd.on('close', () => {
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
