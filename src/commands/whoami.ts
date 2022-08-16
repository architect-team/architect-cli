import BaseCommand from '../base-command';

export default class WhoAmI extends BaseCommand {
  static aliases = ['whoami'];
  static description = 'Get the logged in user';
  static examples = [
    'architect whoami',
  ];
  async auth_required(): Promise<boolean> {
    return true;
  }

  async run(): Promise<void> {
    this.log((await this.app.auth.getPersistedTokenJSON())?.email);
  }
}
