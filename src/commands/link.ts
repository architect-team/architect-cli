import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import { buildSpecFromPath } from '../';
import BaseCommand from '../base-command';
import BaseTable from '../base-table';

declare const process: NodeJS.Process;

export default class Link extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Link a local component to the host to be used to power local deployments or list all linked components.';

  static flags = {
    ...BaseCommand.flags,
  };

  static args = [{
    non_sensitive: true,
    name: 'componentPathOrList',
    description: 'Provide a component path or list all linked components using "architect link list"',
    default: '.',
  }];

  static non_sensitive = new Set([...Object.keys({ ...Link.flags }), ...Link.args.map(arg => arg.name)]);

  listLinkedComponents(): void {
    const table = new BaseTable({ head: ['Component', 'Path'] });
    for (const entry of Object.entries(this.app.linkedComponents)) {
      table.push(entry);
    }
    this.log(table.toString());
  }

  async run(): Promise<void> {
    const { args } = await this.parse(Link);

    if (args.componentPathOrList === 'list') {
      this.listLinkedComponents();
    } else {
      const component_path = path.resolve(untildify(args.componentPathOrList));
      // Try to load the component from the path to ensure it exists and is valid
      try {
        const component_config = buildSpecFromPath(component_path);
        this.app.linkComponentPath(component_config.name, component_path);
        this.log(`Successfully linked ${chalk.green(component_config.name)} to local system at ${chalk.green(component_path)}.`);
      } catch (err: any) {
        if (err.name === 'missing_config_file') {
          this.log(chalk.red(err.message));
        } else {
          throw err;
        }
      }
    }
  }
}
