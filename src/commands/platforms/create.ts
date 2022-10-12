import { DeprecatedCommand } from '../../common/utils/deprecated-command';
import ClusterCreate from '../clusters/create';

export default class PlatformCreate extends ClusterCreate { // TODO: backwards compatibility plus tests for it
  @DeprecatedCommand({ newAliases: ClusterCreate.aliases })
  async run(): Promise<void> {
    super.run();
  }
}
