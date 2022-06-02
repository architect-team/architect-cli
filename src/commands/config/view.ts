import Command from '../../base-command';
import Table from '../../base-table';

export default class ConfigView extends Command {
  static is_sensitive = true;
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'View all the CLI configuration settings';
  static aliases = ['config'];

  static flags = {
    ...Command.flags,
  };

  async run(): Promise<void> {
    try {
      const table = new Table({ head: ['Name', 'Value'] });

      for (const entry of Object.entries(this.app.config.toJSON())) {
        table.push(entry);
      }

      this.log(table.toString());
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack?.substring(6);
        if (cli_stacktrace) {
          e.stack += `\n    at${cli_stacktrace}`;
        }
      }
      throw e;
    }
  }
}
