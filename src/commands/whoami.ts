import Command from '../base-command';

export default class WhoAmI extends Command {
  static aliases = ['whoami'];
  static description = 'Get the logged in user';

  auth_required(): boolean {
    return true;
  }

  async run(): Promise<void> {
    this.log((await this.app.auth.getPersistedTokenJSON())?.email);
  }
}
