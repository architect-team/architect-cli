import Command from '../base-command';
import { ToSentry } from '../sentry';

@ToSentry(Error,
  (err, ctx) => {
    const error = err as any;
    error.stack = Error(ctx.id).stack;
    return error;
})
export default class WhoAmI extends Command {
  static aliases = ['whoami'];
  static description = 'Get the logged in user';

  async auth_required(): Promise<boolean> {
    return true;
  }

  static sensitive = new Set();
  static non_sensitive = new Set();

  async run(): Promise<void> {
    this.log((await this.app.auth.getPersistedTokenJSON())?.email);
  }
}
