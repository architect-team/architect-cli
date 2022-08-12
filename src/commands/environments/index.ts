import Account from '../../architect/account/account.entity';
import AccountUtils from '../../architect/account/account.utils';
import BaseCommand from '../../base-command';
import Table from '../../base-table';
import localizedTimestamp from '../../common/utils/localized-timestamp';

export default class Environments extends BaseCommand {
  static aliases = ['environments', 'envs', 'env', 'environments:search', 'envs:search', 'env:search'];
  static description = 'Search environments you have access to';

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
  };

  static args = [{
    sensitive: false,
    name: 'query',
    description: 'Search term used to filter the results',
  }];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Environments);

    let account: Account | undefined = undefined;
    if (flags.account) {
      account = await AccountUtils.getAccount(this.app, flags.account);
    }

    const params = {
      q: args.query || '',
      account_id: account?.id,
    };

    const { data: { rows: environments } } = await this.app.api.get(`/environments`, { params });

    if (!environments.length) {
      if (args.query) {
        this.log(`No environments found matching ${args.query}.`);
      } else {
        this.log('You have not configured any environments yet. Use `architect environments:create` to set up your first one.');
      }
      return;
    }

    const table = new Table({ head: ['Name', 'Account', 'Namespace', 'Created', 'Updated'] });
    for (const env of environments) {
      table.push([
        env.name,
        env.account.name,
        env.namespace,
        localizedTimestamp(env.created_at),
        localizedTimestamp(env.updated_at),
      ]);
    }

    this.log(table.toString());
  }
}
