import Command from '../base-command';

export default class WhoAmI extends Command {
  static aliases = ['whoami'];
  static description = 'Get the logged in user';

  async auth_required(): Promise<boolean> {
    return true;
  }

  static sensitive = new Set();
  static non_sensitive = new Set();

  async run(): Promise<void> {
    try {
      this.log((await this.app.auth.getPersistedTokenJSON())?.email);
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
