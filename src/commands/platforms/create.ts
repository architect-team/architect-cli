import ClusterCreate from '../clusters/create';

export default class PlatformCreate extends ClusterCreate {
  static aliases = ['platforms:register', 'platform:create', 'platforms:create'];
  static state = 'deprecated';
  static deprecationOptions = {
    to: 'clusters:register',
  };
  static hidden = true;

  async run(): Promise<void> {
    await super.run();
  }
}
