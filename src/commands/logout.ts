import { flags } from '@oclif/command';
import chalk from 'chalk';
import Command from '../base';

const _success = chalk.green;

export default class Logout extends Command {
  static description = 'Logout of the Architect registry';

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  async run() {
    await this.architect.logout();
    this.log(_success('Removed login credentials'));
  }
}
