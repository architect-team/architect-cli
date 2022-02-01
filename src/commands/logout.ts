import chalk from 'chalk';
import Command from '../base-command';
import * as Docker from '../common/utils/docker';

export default class Logout extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Logout from the Architect registry';

  static flags = { ...Command.flags };

  async run(): Promise<void> {
    await Docker.verify(); // docker is required for logout because we run `docker logout`
    await this.app.auth.logout();
    this.log(chalk.green('Logout successful'));
  }
}
