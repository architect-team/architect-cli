import { flags } from '@oclif/command';
import * as fs from 'fs-extra';

import Command from '../../base';

export default class Generate extends Command {
  static description = 'Generate terraform template for service and dependencies';
  static usage = 'services:generate [ID] [OPTIONS]';

  static args = [
    { name: 'service_id', description: 'Service Id', required: true },
    { name: 'service_version', description: 'Service Version', required: true },
    { name: 'environment_id', description: 'Environment Id', required: true }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    file: flags.string({ char: 'f' })
  };

  async run() {
    const { args, flags } = this.parse(Generate);
    const params = { environment_id: args.environment_id, service_version: args.service_version };
    const { data: template } = await this.architect.get(`/repositories/${args.service_id}/generate`, { params });
    if (flags.file) {
      await fs.writeJson(flags.file, template, { spaces: 2 });
    } else {
      this.styled_json(template);
    }
  }
}
