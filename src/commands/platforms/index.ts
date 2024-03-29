import Clusters from '../clusters';

export default class Platforms extends Clusters {
  static aliases = ['platform', 'platform:search', 'platforms', 'platforms:search'];
  static state = 'deprecated';
  static deprecationOptions = {
    to: 'clusters',
  };
  static hidden = true;

  async run(): Promise<void> {
    await super.run();
  }
}
