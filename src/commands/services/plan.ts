import { flags } from '@oclif/command';
import * as fs from 'fs-extra';

import Command from '../../base';

export default class Plan extends Command {
  static description = 'Plan terraform template for service and dependencies';
  static usage = 'services:plan [ID] [OPTIONS]';

  static args = [
    { name: 'id', description: 'Service Id', required: true },
    { name: 'environment_id', description: 'Environment Id', required: true }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    file: flags.string({ char: 'f' })
  };

  async run() {
    const { args, flags } = this.parse(Plan);
    const { data: template } = await this.architect.get(`/repositories/${args.id}/plan/${args.environment_id}`);
    if (flags.file) {
      await fs.writeFile(flags.file, template);
    } else {
      this.log(template);
    }
  }
}
