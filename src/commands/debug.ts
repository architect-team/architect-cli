import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import {spawn} from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import DeploymentConfig, {ServiceEnvironment} from '../common/deployment-config';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';

const AVAILABLE_PORTS = ['50051', '50052', '50053', '50054', '50055'];

export default class Debug extends Command {
  static description = 'Start the service locally';

  static flags = {
    help: flags.help({char: 'h'}),
    config_path: flags.string({
      char: 'c',
      description: 'Path to a config file containing locations of ' +
        'each service in the application'
    })
  };

  static buildDeploymentConfigPath(service_config: ServiceConfig): string {
    const hidden_path = path.join(os.homedir(), MANAGED_PATHS.HIDDEN);
    if (!fs.existsSync(hidden_path)) {
      fs.mkdirSync(hidden_path);
    }

    const deployments_path = path.join(hidden_path, MANAGED_PATHS.DEPLOYMENT_CONFIGS);
    if (!fs.existsSync(deployments_path)) {
      fs.mkdirSync(deployments_path);
    }

    return path.join(deployments_path, `${service_config.name}.json`);
  }

  static loadDeploymentConfig(config_path: string): DeploymentConfig {
    if (fs.existsSync(config_path)) {
      return require(config_path);
    } else {
      const config = {};
      Debug.saveDeploymentConfig(config_path, config);
      return config;
    }
  }

  static saveDeploymentConfig(config_path: string, config: DeploymentConfig): void {
    fs.writeFileSync(config_path, JSON.stringify(config, null, 2));
  }

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
      const isAvailable = await Debug.isPortAvailable(p);
      if (isAvailable) {
        port = p;
        break;
      }
    }

    if (!port) throw new Error('No valid ports available');
    return port;
  }

  async run() {
    try {
      const {flags} = this.parse(Debug);

      const service_path = process.cwd();
      const service_config = ServiceConfig.loadFromPath(service_path);

      let config_path = flags.config_path;
      if (!config_path || !fs.existsSync(config_path)) {
        config_path = Debug.buildDeploymentConfigPath(service_config);
      }

      let deployment_config = await this.startService(service_path, config_path);
      // Debug.saveDeploymentConfig(config_path, deployment_config);

      this.log(JSON.stringify(deployment_config, null, 2));
      this.exit();
    } catch (error) {
      this.error(error);
      this.exit(1);
    }
  }

  async startService(service_path: string, config_path: string): Promise<DeploymentConfig> {
    let deployment_config = Debug.loadDeploymentConfig(config_path);
    const service_config = ServiceConfig.loadFromPath(service_path);
    Object.keys(service_config.dependencies).forEach(async dependency_name => {
      const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(
        service_config.dependencies[dependency_name]
      );
      deployment_config = await this.startService(dependency_path, config_path);
    });

    // Check if the service is already running
    if (Object.keys(deployment_config).includes(service_config.name)) {
      const instance_details = deployment_config[service_config.name];
      this.log(`${service_config.name} already deployed at ${instance_details.host}:${instance_details.port}`);
      return deployment_config;
    }

    this.log(`Deploying ${chalk.blue(service_config.name)}`);
    deployment_config[service_config.name] = await this.executeLauncher(config_path, service_path, service_config);
    return deployment_config;
  }

  async executeLauncher(
    deployment_config_path: string,
    service_path: string,
    service_config: ServiceConfig
  ): Promise<ServiceEnvironment> {
    return new Promise<ServiceEnvironment>(async (resolve, reject) => {
      try {
        const cmd_path = path.join(__dirname, '../../launchers/', service_config.language, 'launcher');

        const target_port = await Debug.getAvailablePort();
        const cmd = spawn(cmd_path, [
          '--target_port', `${target_port}`,
          '--service_path', service_path,
          '--config_path', deployment_config_path,
        ]);

        let host: string;
        let port: string;
        cmd.stdout.on('data', data => {
          data = data.toString();
          if (data.indexOf('Host: ') === 0) {
            host = data.substring(6).trim();
          } else if (data.indexOf('Port: ') === 0) {
            port = data.substring(6).trim();
          }

          if (host && port) {
            resolve({
              host,
              port: parseInt(port, 10),
              service_path
            });
          }
        });

        cmd.stderr.on('data', data => {
          data = data.toString();
          console.log(data);
        });

        cmd.on('close', () => {
          reject(new ServiceLaunchError(service_config.name));
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
