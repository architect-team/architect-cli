import Table from 'cli-table3';
import Command from '../../base-command';

export default class Services extends Command {
  static aliases = ['services', 'services:search'];
  static description = 'Search for services on Architect Cloud';

  static flags = {
    ...Command.flags,
  }

  static args = [{
    name: 'query',
    description: 'Search query used to filter results',
    required: false,
  }];

  async run() {
    const {args} = this.parse(Services);

    const { data: results } = await this.app.api.get(`/services?q=${args.query || ''}`);

    const table = new Table({ head: ['Name', 'Created', 'Updated'] });
    for (const row of results) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      table.push([row.name, row.created_at, row.updated_at]);
    }

    this.log(table.toString());
  }
}
