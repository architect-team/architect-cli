import Command from '../../base-command';
import Table from '../../base-table';

export default class ConfigView extends Command {
  auth_required() {
    return false;
  }

  static description = 'View all the CLI configuration settings';
  static aliases = ['config'];

  static flags = {
    ...Command.flags,
  };

  async run() {
    const table = new Table({ head: ['Name', 'Value'] });

    for (const entry of Object.entries(this.app.config.toJSON())) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      table.push(entry);
    }

    this.log(table.toString());
  }
}
