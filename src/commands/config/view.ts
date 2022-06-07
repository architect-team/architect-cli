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

  static sensitive = new Set([...Object.keys({ ...this.flags })]);

  static non_sensitive = new Set();

  async run(): Promise<void> {
    try {
      const table = new Table({ head: ['Name', 'Value'] });

      for (const entry of Object.entries(this.app.config.toJSON())) {
        table.push(entry);
      }

      this.log(table.toString());
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }
}
