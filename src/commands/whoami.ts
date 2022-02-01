import Command from '../base-command';

export default class WhoAmI extends Command {
  static aliases = ['whoami'];
  static description = 'Get the logged in user';

  async auth_required(): Promise<boolean> {
    return true;
  }

  async run(): Promise<void> {
    this.log((await this.app.auth.getPersistedTokenJSON())?.email);
  }
}
