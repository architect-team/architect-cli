import Table from 'cli-table3';
import Command from '../../base-command';

export default class Environments extends Command {
  static aliases = ['environments', 'envs', 'env', 'environments:list', 'envs:list', 'env:list'];
  static description = 'List environments you have access to';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'query',
    description: 'Search term used to filter the results',
  }];

  async run() {
    const {args} = this.parse(Environments);

    const { data: results } = await this.app.api.get(`/environments?q=${args.query || ''}`);

    const table = new Table({ head: ['Name', 'Account', 'Created', 'Updated'] });
    for (const row of results) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      table.push([row.name, row.namespace, row.created_at, row.updated_at]);
    }

    this.log(table.toString());
  }
}
