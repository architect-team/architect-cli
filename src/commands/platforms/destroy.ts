import ClusterDestroy from '../clusters/destroy';

export default class PlatformDestroy extends ClusterDestroy {
  static aliases = ['platforms:deregister', 'platform:destroy', 'platforms:destroy'];
  static state = 'deprecated';
  static deprecationOptions = {
    to: 'cluster:deregister',
  };

  async run(): Promise<void> {
    await super.run();
  }
}
