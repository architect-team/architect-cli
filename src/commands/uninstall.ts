import { flags } from '@oclif/command';
import chalk from 'chalk';
import Command from '../base-command';

export default class Uninstall extends Command {
  static description = 'Uninstall a dependency from the current service';

  static flags = {
    ...Command.flags,
    service: flags.string({
      char: 's',
      description: 'Path to service root',
    }),
  };

  static args = [{
    name: 'dependency_name',
    description: 'Name of the dependency to remove',
    required: true,
  }];

  async run() {
    const {flags, args} = this.parse(Uninstall);
    let service_path = process.cwd();
    if (flags.service) {
      service_path = flags.service;
    }

    const config = this.getServiceConfig(service_path);
    if (Object.keys(config.dependencies).includes(args.dependency_name)) {
      delete config.dependencies[args.dependency_name];
      this.saveServiceConfig(service_path, config);
      this.log(chalk.green(`Successfully uninstalled ${args.dependency_name} from ${config.name}`));
    } else {
      this.log(`${config.name} does not have ${args.dependency_name} as a dependency. Skipping.`);
    }
  }
}
