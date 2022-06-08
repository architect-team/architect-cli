import Command from '../../base-command';
import Table from '../../base-table';
import { ToSentry } from '../../sentry';

@ToSentry(Error,
  (err, ctx) => {
    const error = err as any;
    error.stack = Error(ctx.id).stack;
    return error;
})
export default class ConfigView extends Command {

  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'View all the CLI configuration settings';
  static aliases = ['config'];

  static flags = {
    ...Command.flags,
  };

  static sensitive = new Set([...Object.keys({ ...ConfigView.flags })]);

  static non_sensitive = new Set();

  async run(): Promise<void> {
    const table = new Table({ head: ['Name', 'Value'] });

    for (const entry of Object.entries(this.app.config.toJSON())) {
      table.push(entry);
    }

    this.log(table.toString());
  }
}
