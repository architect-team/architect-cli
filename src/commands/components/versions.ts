import Account from '../../architect/account/account.entity';
import AccountUtils from '../../architect/account/account.utils';
import Command from '../../base-command';
import Table from '../../base-table';
import localizedTimestamp from '../../common/utils/localized-timestamp';

interface ComponentVersion {
  created_at: string;
  tag: string;
}

export default class ComponentVersions extends Command {
  static aliases = ['component:versions', 'component:version'];
  static description = 'Search component versions of a particular component';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
  };

  static args = [{
    name: 'component_name',
  }];

  static sensitive = new Set();

  static non_sensitive = new Set([...Object.keys({ ...this.flags }), ...this.args.map(arg => arg.name)]);

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(ComponentVersions);

      if (!args.component_name) {
        this.log('You must specify the name of a component.');
        return;
      }

      const account: Account = await AccountUtils.getAccount(this.app, flags.account);

      const { data: component } = await this.app.api.get(`/accounts/${account.name}/components/${args.component_name}`);
      const { data: { rows: component_versions } } = await this.app.api.get(`/components/${component.component_id}/versions`);

      const table = new Table({ head: ['Tag', 'Created'] });
      for (const component_version of component_versions.sort((cv1: ComponentVersion, cv2: ComponentVersion) => cv1.tag.localeCompare(cv2.tag))) {
        table.push([
          component_version.tag,
          localizedTimestamp(component_version.created_at),
        ]);
      }

      this.log(table.toString());
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }
}
