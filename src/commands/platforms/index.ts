import Account from '../../architect/account/account.entity';
import AccountUtils from '../../architect/account/account.utils';
import Command from '../../base-command';
import Table from '../../base-table';
import localizedTimestamp from '../../common/utils/localized-timestamp';

export default class Platforms extends Command {
  static aliases = ['platform', 'platform:search', 'platforms', 'platforms:search'];
  static description = 'Search for platforms on Architect Cloud';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
  };

  static args = [{
    name: 'query',
    description: 'Search query used to filter results',
    required: false,
  }];

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(Platforms);

      let account: Account | undefined = undefined;
      if (flags.account) {
        account = await AccountUtils.getAccount(this.app, flags.account);
      }

      const params = {
        q: args.query || '',
        account_id: account?.id,
      };

      const { data: { rows: platforms } } = await this.app.api.get(`/platforms`, { params });

      if (!platforms.length) {
        if (args.query) {
          this.log(`No platforms found matching ${args.query}.`);
        } else {
          this.log('You have not configured any platforms yet. Use `architect platform:create` to set up your first one.');
        }
        return;
      }

      const table = new Table({ head: ['Name', 'Account', 'Host', 'Type', 'Credentials', 'Created', 'Updated'] });
      for (const row of platforms) {
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
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack?.substring(6);
        if (cli_stacktrace) {
          e.stack += `\n    at${cli_stacktrace}`;
        }
      }
      throw e;
    }
  }
}
