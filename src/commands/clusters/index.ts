import Account from '../../architect/account/account.entity';
import AccountUtils from '../../architect/account/account.utils';
import BaseCommand from '../../base-command';
import Table from '../../base-table';
import localizedTimestamp from '../../common/utils/localized-timestamp';

export default class Clusters extends BaseCommand {
  static aliases = ['cluster', 'cluster:search', 'clusters', 'clusters:search'];
  static description = 'Search for clusters on Architect Cloud';
  static examples = [
    'architect clusters',
    'architect clusters --account=myaccount mycluster',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
  };

  static args = [{
    sensitive: false,
    name: 'query',
    description: 'Search query used to filter results',
    required: false,
  }];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Clusters);

    let account: Account | undefined;
    if (flags.account) {
      account = await AccountUtils.getAccount(this.app, flags.account);
    }

    const params = {
      q: args.query || '',
      account_id: account?.id,
    };

    const { data: { rows: clusters } } = await this.app.api.get(`/clusters`, { params });

    if (clusters.length === 0) {
      if (args.query) {
        this.log(`No clusters found matching ${args.query}.`);
      } else {
        this.log('You have not configured any clusters yet. Use `architect cluster:create` to set up your first one.');
      }
      return;
    }

    const table = new Table({ head: ['Name', 'Account', 'Host', 'Type', 'Credentials', 'Created', 'Updated'] });
    for (const row of clusters) {
      table.push([
        row.name,
        row.account.name,
        row.properties.host,
        row.type,
        'Encrypted on Server',
        localizedTimestamp(row.created_at),
        localizedTimestamp(row.updated_at),
      ]);
    }

    this.log(table.toString());
  }
}
