import { flags } from '@oclif/command';
import chalk from 'chalk';
import { plainToClass } from 'class-transformer';
import execa from 'execa';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import Command from '../base-command';
import * as DockerCompose from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import EnvironmentConfig from '../common/environment-config';
import EnvironmentConfigV1 from '../common/environment-config/v1';
<<<<<<< Updated upstream
import { genFromLocalPaths } from '../common/utils/dependency';
=======
import MissingRequiredParamError from '../common/errors/missing-required-param';
import ServiceConfig from '../common/service-config';
import ServiceParameterConfig from '../common/service-config/parameter';
>>>>>>> Stashed changes

declare const process: NodeJS.Process;

export default class Deploy extends Command {
  static description = 'Create a deploy job on Architect Cloud or run stacks locally';

  static flags = {
    ...Command.flags,
    local: flags.boolean({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
    }),
    config: flags.string({
      char: 'c',
      description: 'Path to an environment config file for the environment',
    }),
    services: flags.string({
      char: 's',
      description: 'Paths to services to deploy',
      multiple: true,
    }),
    compose_file: flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: path.join(
        os.tmpdir(),
        `architect-deployment-${Date.now().toString()}.json`,
      ),
    }),
  };

  async runCompose(compose: DockerComposeTemplate) {
    const { flags } = this.parse(Deploy);
    Object.keys(compose.services).forEach(svc_name => {
      const exposed_port = compose.services[svc_name].ports[0].split(':')[0];
      this.log(`${chalk.blue(`0.0.0.0:${exposed_port}`)} => ${svc_name}`);
    });
    await fs.ensureFile(flags.compose_file);
    await fs.writeJSON(flags.compose_file, compose, { spaces: 2 });
    this.log(`Wrote docker-compose file to: ${flags.compose_file}`);
    // this.log(chalk.green(JSON.stringify(compose, null, 2)));
    await execa('docker-compose', ['-f', flags.compose_file, 'up', '--build', '--abort-on-container-exit'], { stdio: 'inherit' });
  }

<<<<<<< Updated upstream
=======
  private validateParams(
    ref_name: string,
    parameters: { [s: string]: ServiceParameterConfig },
    env_params: { [s: string]: string },
  ): { [key: string]: string } {
    return Object.keys(parameters)
      .reduce((params: { [s: string]: string }, key: string) => {
        const service_param = parameters[key];
        if (service_param.isRequired() && !env_params[key]) {
          throw new MissingRequiredParamError(key, service_param, ref_name);
        }

        let val = env_params[key] || service_param.default || '';
        if (typeof val !== 'string') {
          val = val.toString();
        }

        if (val.startsWith('file:')) {
          val = fs.readFileSync(untildify(val.slice('file:'.length)), 'utf-8');
        }
        params[key] = val.toString();
        if (service_param.alias) {
          params[service_param.alias] = val.toString();
        }
        return params;
      }, {});
  }

  private async addDatastoreNodes(
    parent_node: LocalDependencyNode | RemoteDependencyNode,
    parent_config: ServiceConfig,
    dependency_manager: DependencyManager,
  ): Promise<DependencyManager> {
    const { flags } = this.parse(Deploy);

    // Load environment config
    let env_config: EnvironmentConfig = new EnvironmentConfigV1();
    if (flags.config) {
      const config_payload = await fs.readJSON(path.resolve(flags.config));
      env_config = plainToClass(EnvironmentConfigV1, config_payload);
    }

    for (const [ds_name, ds_config] of Object.entries(parent_config.datastores)) {
      const docker_config = ds_config.getDockerConfig();
      const dep_node = await RemoteDependencyNode.create({
        name: `${parent_config.name}.${ds_name}`,
        tag: 'local',
        image: docker_config.image,
        target_port: docker_config.target_port,
        parameters: this.validateParams(
          `${parent_config.name} - [datastore] ${ds_name}`,
          parent_config.datastores[ds_name].parameters || {},
          env_config.getDatastoreParameters(parent_config.name, ds_name),
        ),
      });
      dep_node.isDatastore = true;
      dependency_manager.addNode(dep_node);
      dependency_manager.addDependency(parent_node, dep_node);
    }

    return dependency_manager;
  }

  private async addDependencyNodes(
    parent_node: LocalDependencyNode | RemoteDependencyNode,
    parent_config: ServiceConfig,
    dependency_manager: DependencyManager,
  ): Promise<DependencyManager> {
    const { flags } = this.parse(Deploy);

    // Load environment config
    let env_config: EnvironmentConfig = new EnvironmentConfigV1();
    if (flags.config) {
      const config_payload = await fs.readJSON(path.resolve(flags.config));
      env_config = plainToClass(EnvironmentConfigV1, config_payload);
    }

    if (parent_node instanceof LocalDependencyNode) {
      for (const [dep_name, dep_id] of Object.entries(parent_config.getDependencies())) {
        if (dep_id.startsWith('file:')) {
          const dep_path = path.join(parent_node.service_path, dep_id.slice('file:'.length));
          const dep_config = this.getServiceConfig(dep_path);
          const dep_node = await LocalDependencyNode.create({
            service_path: dep_path,
            name: dep_name,
            tag: 'local',
            target_port: 8080,
            api_type: dep_config.api ? dep_config.api.type : undefined,
            subscriptions: dep_config.subscriptions,
            parameters: this.validateParams(
              dep_config.name,
              dep_config.parameters,
              env_config.getServiceParameters(dep_config.name),
            ),
          });
          if (dep_config.debug) {
            dep_node.command = dep_config.debug;
          }
          dependency_manager.addNode(dep_node);
          dependency_manager.addDependency(parent_node, dep_node);
          await this.addDependencyNodes(dep_node, dep_config, dependency_manager);
          await this.addDatastoreNodes(dep_node, dep_config, dependency_manager);
        }
      }
    }

    return dependency_manager;
  }

>>>>>>> Stashed changes
  private async runLocal() {
    const { flags } = this.parse(Deploy);

    const service_paths = flags.services || [process.cwd()];

    // Load environment config
    let env_config: EnvironmentConfig = new EnvironmentConfigV1();
    if (flags.config) {
      const config_payload = await fs.readJSON(path.resolve(flags.config));
      env_config = plainToClass(EnvironmentConfigV1, config_payload);
    }

    const dependencies = await genFromLocalPaths(service_paths, env_config);
    const compose = DockerCompose.generate(dependencies);
    await this.runCompose(compose);
  }

  async run() {
    const { flags } = this.parse(Deploy);

    if (flags.local) {
      await this.runLocal();
    }
  }
}
