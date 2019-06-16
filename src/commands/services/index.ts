import { flags } from '@oclif/command';

import Command from '../../base';

export default class Services extends Command {
  static description = 'List, create, or delete services';
  static usage = 'services [OPTIONS]\n$ architect services:generate [ID] [OPTIONS]\n$ architect services:plan [ID] [OPTIONS]';
  static aliases = ['services:list'];

  static args = [
    { name: 'id', description: 'Service Id', required: false }
  ];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  async run() {
    const { args } = this.parse(Services);

    const url = args.id ? `/repositories/${args.id}` : '/repositories';
    const { data: services } = await this.architect.get(url);
    this.styled_json(services);
  }
}
