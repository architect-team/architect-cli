import chalk from 'chalk';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';

export default class Logout extends Command {
  auth_required() {
    return false;
  }

  static description = 'Logout from the Architect registry';

  static flags = { ...Command.flags };

  async run() {
    await DockerComposeUtils.validateDocker(); // docker is required for logout because we run `docker logout`
    await this.app.auth.logout();
    this.log(chalk.green('Logout successful'));
  }
}
