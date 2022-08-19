import chalk from 'chalk';
import BaseCommand from '../base-command';
import { RequiresDocker } from '../common/docker/helper';

export default class Logout extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Logout from the Architect registry';
  static examples = [
    'architect logout',
  ];
  static flags = { ...BaseCommand.flags };

  @RequiresDocker()  // docker is required for logout because we run `docker logout`
  async run(): Promise<void> {
    await this.app.auth.logout();
    this.log(chalk.green('Logout successful'));
  }
}

