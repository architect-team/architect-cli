import Command from '../base-command';

export default class WhoAmI extends Command {
  static aliases = ['whoami'];
  static description = 'Get the logged in user';

  auth_required() {
    return true;
  }

  async run() {
    this.log((await this.app.auth.getPersistedTokenJSON())?.email);
  }
}
