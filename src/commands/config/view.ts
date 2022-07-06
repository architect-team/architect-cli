import BaseCommand from '../../base-command';
import Table from '../../base-table';

export default class ConfigView extends BaseCommand {

  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'View all the CLI configuration settings';
  static aliases = ['config'];

  static flags = {
    ...BaseCommand.flags,
  };

  async run(): Promise<void> {
    const table = new Table({ head: ['Name', 'Value'] });

    for (const entry of Object.entries(this.app.config.toJSON())) {
      table.push(entry);
    }

    this.log(table.toString());
  }
}
