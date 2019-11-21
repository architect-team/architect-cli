import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { flags } from '@oclif/command';
import execa from 'execa';
import chalk from 'chalk';

import Command from '../base-command';
import DockerComposeTemplate from '../common/docker-compose/template';
import * as DockerCompose from '../common/docker-compose';
import { EnvironmentConfigBuilder, EnvironmentConfig } from '../dependency-manager/src';
import LocalDependencyManager from '../common/dependency-manager/local-manager';

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

  private async runLocal() {
    const { flags } = this.parse(Deploy);

    const service_paths = flags.services || [process.cwd()];

    // Load environment config
    let env_config: EnvironmentConfig = EnvironmentConfigBuilder.buildFromJSON({});
    if (flags.config) {
      env_config = EnvironmentConfigBuilder.buildFromPath(path.resolve(flags.config));
    }

    const dependency_manager = new LocalDependencyManager(this.app.api, env_config);
    for (let svc_path of service_paths) {
      svc_path = path.resolve(svc_path);
      const [node, config] = await dependency_manager.loadLocalService(svc_path);
      await dependency_manager.loadDependencies(node, config);
    }
    const compose = DockerCompose.generate(dependency_manager);
    await this.runCompose(compose);
  }

  async run() {
    const {flags} = this.parse(Deploy);

    if (flags.local) {
      await this.runLocal();
    }
  }
}
