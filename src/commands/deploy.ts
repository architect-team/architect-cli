import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { flags } from '@oclif/command';
import execa from 'execa';
import chalk from 'chalk';
import untildify from 'untildify';

import Command from '../base-command';
import DockerComposeTemplate from '../common/docker-compose/template';
import * as DockerCompose from '../common/docker-compose';
import LocalDependencyManager from '../common/dependency-manager/local-manager';

class EnvConfigRequiredError extends Error {
  constructor() {
    super();
    this.name = 'environment_config_required';
    this.message = 'An environment configuration is required';
  }
}

export default class Deploy extends Command {
  static description = 'Create a deploy job on Architect Cloud or run stacks locally';

  static flags = {
    ...Command.flags,
    local: flags.boolean({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
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

  static args = [{
    name: 'environment_config',
    description: 'Path to an Architect environment config file',
  }];

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
    const { args } = this.parse(Deploy);

    if (!args.environment_config) {
      throw new EnvConfigRequiredError();
    }

    const dependency_manager = await LocalDependencyManager.createFromPath(
      this.app.api,
      path.resolve(untildify(args.environment_config)),
    );
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
