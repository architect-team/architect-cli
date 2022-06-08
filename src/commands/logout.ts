import chalk from 'chalk';
import Command from '../base-command';
import * as Docker from '../common/utils/docker';
import { ToSentry } from '../sentry';

@ToSentry(Error,
  (err, ctx) => {
    const error = err as any;
    error.stack = Error(ctx.id).stack;
    return error;
})
export default class Logout extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Logout from the Architect registry';

  static flags = { ...Command.flags };

  static sensitive = new Set();

  static non_sensitive = new Set([...Object.keys({ ...Logout.flags })]);

  async run(): Promise<void> {
    await Docker.verify(); // docker is required for logout because we run `docker logout`
    await this.app.auth.logout();
    this.log(chalk.green('Logout successful'));
  }
}

