import { DeprecatedCommand } from '../../common/utils/deprecated-command';
import ClusterCreate from '../clusters/create';

export default class PlatformCreate extends ClusterCreate {
  static aliases = ['platforms:register', 'platform:create', 'platforms:create'];

  @DeprecatedCommand({ new_aliases: ClusterCreate.aliases })
  async run(): Promise<void> {
    await super.run();
  }
}
