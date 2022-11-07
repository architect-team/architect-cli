import ClusterCreate from '../clusters/create';

export default class PlatformCreate extends ClusterCreate {
  static aliases = ['platforms:register', 'platform:create', 'platforms:create'];
  static state = 'deprecated';
  static deprecationOptions = {
    to: 'cluster:register',
  };

  async run(): Promise<void> {
    await super.run();
  }
}
