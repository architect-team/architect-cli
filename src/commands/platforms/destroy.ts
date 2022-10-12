import { DeprecatedCommand } from '../../common/utils/deprecated-command';
import ClusterDestroy from '../clusters/destroy';

export default class PlatformDestroy extends ClusterDestroy {
  @DeprecatedCommand({ newAliases: ClusterDestroy.aliases })
  async run(): Promise<void> {
    super.run();
  }
}
