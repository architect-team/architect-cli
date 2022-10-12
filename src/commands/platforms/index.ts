import { DeprecatedCommand } from '../../common/utils/deprecated-command';
import Clusters from '../clusters';

export default class Platforms extends Clusters {
  @DeprecatedCommand({ newAliases: Clusters.aliases })
  async run(): Promise<void> {
    super.run();
  }
}
