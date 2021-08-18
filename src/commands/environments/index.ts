import Command from '../../base-command';
import Table from '../../base-table';
import { Account, AccountUtils } from '../../common/utils/account';
import localizedTimestamp from '../../common/utils/localized-timestamp';

export default class Environments extends Command {
  static aliases = ['environments', 'envs', 'env', 'environments:search', 'envs:search', 'env:search'];
  static description = 'Search environments you have access to';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
  };

  static args = [{
    name: 'query',
    description: 'Search term used to filter the results',
  }];

  async run() {
    const { args, flags } = this.parse(Environments);

    let account: Account | undefined = undefined;
    if (flags.account) {
      account = await AccountUtils.getAccount(this.app.api, flags.account);
    }

    const params = {
      q: args.query || '',
      account_id: account?.id,
    };

    const { data: { rows: environments } } = await this.app.api.get(`/environments`, { params });

    if (!environments.length) {
      this.log('You have not configured any environments yet.');
      return;
    }

    const table = new Table({ head: ['Name', 'Account', 'Namespace', 'Created', 'Updated'] });
    for (const env of environments) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
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
