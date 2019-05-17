import { flags } from '@oclif/command';

import Command from '../../base';

export default class Services extends Command {
  static description = 'List, create, or delete services';
  static usage = 'services [OPTIONS]\n$ architect services:generate [ID] [OPTIONS]';
  static aliases = ['services:list'];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  async run() {
    this.parse(Services);

    const { body: services } = await this.architect.get('/registry/repositories');
    this.styled_json(services);
  }
}
