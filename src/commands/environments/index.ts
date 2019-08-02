import { flags } from '@oclif/command';
import Command from '../../base';

export default class Environments extends Command {
  static description = 'List, create, or delete environments';
  static aliases = ['environments:list', 'environment', 'environment:list'];

  static args = [
    { name: 'environment', description: 'Environment name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' })
  };

  async run() {
    const { args } = this.parse(Environments);

    if (args.environment) {
      const { data: environment } = await this.architect.get(`/environments/${args.environment}`);
      this.styled_json(environment);
    } else {
      const { data: environments } = await this.architect.get('/environments');
      this.styled_json(environments);
    }
  }
}
