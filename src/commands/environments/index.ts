import { flags } from '@oclif/command';

import Command from '../../base';

export default class Environments extends Command {
  static description = 'List, create, or delete environments';
  static aliases = ['environments:list'];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  async run() {
    this.parse(Environments);

    const { body: environments } = await this.architect.get('/environments');
    this.styled_json(environments);
  }
}
