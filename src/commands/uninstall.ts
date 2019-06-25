import { flags } from '@oclif/command';
import chalk from 'chalk';
import path from 'path';

import Command from '../base';
import ServiceConfig from '../common/service-config';

const _info = chalk.blue;

export default class Uninstall extends Command {
  static description = 'Uninstall dependencies of the current service';

  static flags = {
    help: flags.help({ char: 'h' }),
    prefix: flags.string({
      char: 'p',
      description: 'Path prefix indicating where the install command should execute from'
    })
  };

  static args = [
    {
      name: 'service_name',
      required: true
    }
  ];

  async run() {
    const { args, flags } = this.parse(Uninstall);
    let root_service_path = process.cwd();
    if (flags.prefix) {
      root_service_path = path.isAbsolute(flags.prefix) ? flags.prefix : path.join(root_service_path, flags.prefix);
    }
    const config_json = ServiceConfig.loadJSONFromPath(root_service_path);
    delete config_json.dependencies[args.service_name];
    ServiceConfig.writeToPath(root_service_path, config_json);
    this.log(`Uninstalled ${_info(args.service_name)}`);
  }
}
