import Command from '../base-command';
import { flags } from '@oclif/command';
import chalk from 'chalk';

declare const process: NodeJS.Process;

export default class Install extends Command {
  static description = 'Install services and their generate the corresponding client libraries';

  static args = [{
    name: 'service_name',
    description: 'Name of or path to the service to install',
    required: false,
  }];

  static flags = {
    ...Command.flags,
    service: flags.string({
      char: 's',
      description: 'Path to services to generate client code for',
      multiple: true,
      exclusive: ['service_name'],
    }),
    recursive: flags.boolean({
      char: 'r',
      description: 'Recursively generates required client code for downstream dependencies',
      default: false,
      exclusive: ['service_name'],
    }),
  };

  private async installSingle(service_id: string) {
    const service_dir = process.cwd();
    const parts = service_id.split(':');
    const service_name = parts[0];
    let service_tag = parts[1];
    const config = this.getServiceConfig(service_dir);

    if (config.name === service_name) {
      throw new Error('Services cannot depend on themselves');
    }

    const { data: service } = await this.app.api.get(`/services/${service_name}`);
    if (!service) {
      throw new Error(`Service not found in the registry`);
    }

    // Get the latest tag if none exists
    if (!service_tag) {
      service_tag = service.tags.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }))[0];
    }

    if (!config.dependencies) {
      config.dependencies = {};
    }

    config.dependencies[service_name] = service_tag;
    this.saveServiceConfig(service_dir, config);
    this.log(chalk.green(`${service_name}:${service_tag} installed successfully`));
  }

  async run() {
    const {args} = this.parse(Install);

    if (args.service_name) {
      await this.installSingle(args.service_name);
    } else {
      // TODO: codegen for existing services
    }
  }
}
