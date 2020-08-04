import Table from 'cli-table3';
import Command from '../../base-command';

export default class Environments extends Command {
  static aliases = ['environments', 'envs', 'env', 'environments:search', 'envs:search', 'env:search'];
  static description = 'Search environments you have access to';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'query',
    description: 'Search term used to filter the results',
  }];

  async run() {
    const { args } = this.parse(Environments);

    const { data: { rows: environments } } = await this.app.api.get(`/environments?q=${args.query || ''}`);

    if (!environments.length) {
      this.log('You have not configured any environments yet.');
      return;
    }

    const table = new Table({ head: ['Name', 'Account', 'Namespace', 'Created', 'Updated'] });
    for (const env of environments) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      table.push([env.name, env.account.name, env.namespace, env.created_at, env.updated_at]);
    }

    this.log(table.toString());
  }
}
