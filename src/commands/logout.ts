import chalk from 'chalk';
import Command from '../base-command';

export default class Logout extends Command {
  static description = 'Logout from the Architect registry';

  static flags = { ...Command.flags };

  async run() {
    await this.app.auth.logout();
    this.log(chalk.green('Logout successful'));
  }
}
