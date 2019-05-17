import { flags } from '@oclif/command';
import * as fs from 'fs-extra';

import Command from '../../base';

export default class Generate extends Command {
  static description = 'Generate terraform template for service and dependencies';
  static usage = 'services:generate [ID] [OPTIONS]';

  static args = [
    { name: 'id', description: 'Service Id', required: true }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    file: flags.string({ char: 'f' })
  };

  async run() {
    const { args, flags } = this.parse(Generate);
    const { body: template } = await this.architect.get(`/registry/repositories/${args.id}/generate`);
    if (flags.file) {
      await fs.writeJson(flags.file, template, { spaces: 2 });
    } else {
      this.styled_json(template);
    }
  }
}
