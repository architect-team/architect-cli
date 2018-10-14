import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';

import DeploymentConfig, {ServiceEnvironment} from '../common/deployment-config';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';

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
    return fs.existsSync(config_path) ? require(config_path) : {};
  }

  static saveDeploymentConfig(config_path: string, config: DeploymentConfig): void {
    fs.writeFileSync(config_path, JSON.stringify(config, null, 2));
  }

  static async isPortAvailable(port: string) {
    return new Promise(resolve => {
      const tester: net.Server = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () =>
          tester.once('close', () => resolve(true)).close()
        )
        .listen(port);
    });
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

      let deployment_config = Debug.loadDeploymentConfig(config_path);
      deployment_config = await this.startService(service_path, deployment_config);
      // Debug.saveDeploymentConfig(config_path, deployment_config);

      this.log(JSON.stringify(deployment_config, null, 2));
      this.exit();
    } catch (error) {
      this.error(error);
      this.exit(1);
    }
  }

  async startService(service_path: string, deployment_config: DeploymentConfig): Promise<DeploymentConfig> {
    const service_config = ServiceConfig.loadFromPath(service_path);
    Object.keys(service_config.dependencies).forEach(async dependency_name => {
      const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(
        service_config.dependencies[dependency_name]
      );
      deployment_config = await this.startService(dependency_path, deployment_config);
    });

    // Check if the service is already running
    if (Object.keys(deployment_config).includes(service_config.name)) {
      const instance_details = deployment_config[service_config.name];
      this.log(`${service_config.name} already deployed at ${instance_details.host}:${instance_details.port}`);
      return deployment_config;
    }

    this.log(`Deploying ${chalk.blue(service_config.name)}`);
    deployment_config[service_config.name] = await this.executeLauncher(service_path, service_config);
    return deployment_config;
  }

  async executeLauncher(service_path: string, service_config: ServiceConfig): Promise<ServiceEnvironment> {
    const cmd_path = path.join(__dirname, '../../launchers/', service_config.language, 'launcher');
    return {
      host: cmd_path,
      port: 1234,
      service_path,
    };
  }
}
