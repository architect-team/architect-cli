import Command from '../../base-command';
import Table from '../../base-table';

export default class ConfigView extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'View all the CLI configuration settings';
  static aliases = ['config'];

  static flags = {
    ...Command.flags,
  };

  async run(): Promise<void> {
    const table = new Table({ head: ['Name', 'Value'] });

    for (const entry of Object.entries(this.app.config.toJSON())) {
      table.push(entry);
    }

    this.log(table.toString());
  }
}
