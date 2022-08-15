import chalk from 'chalk';
import BaseCommand from '../base-command';
import { DockerHelper } from '../common/utils/docker';

export default class Logout extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Logout from the Architect registry';
  static examples = [
    'architect logout',
  ];
  static flags = { ...BaseCommand.flags };

  async run(): Promise<void> {
    await DockerHelper.verifyDaemon(); // docker is required for logout because we run `docker logout`
    await this.app.auth.logout();
    this.log(chalk.green('Logout successful'));
  }
}

