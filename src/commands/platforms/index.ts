import { DeprecatedCommand } from '../../common/utils/deprecated-command';
import Clusters from '../clusters';

export default class Platforms extends Clusters {
  static aliases = ['platform', 'platform:search', 'platforms', 'platforms:search'];

  @DeprecatedCommand({ new_aliases: Clusters.aliases })
  async run(): Promise<void> {
    await super.run();
  }
}
