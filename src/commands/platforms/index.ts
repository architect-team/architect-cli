import Table from 'cli-table3';
import Command from '../../base-command';

export default class Platforms extends Command {
  static aliases = ['platforms', 'platforms:search'];
  static description = 'Search for platforms on Architect Cloud';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'query',
    description: 'Search query used to filter results',
    required: false,
  }];

  async run() {
    const { args } = this.parse(Platforms);

    const { data: { rows: platforms } } = await this.app.api.get(`/platforms?q=${args.query || ''}`);

    if (!platforms.length) {
      this.log('You have not configured any platforms yet. Use `architect env:create` to set up your first one.');
      return;
    }

    const table = new Table({ head: ['Name', 'Created', 'Updated'] });
    for (const row of platforms) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      table.push([row.name, row.created_at, row.updated_at]);
    }

    this.log(table.toString());
  }
}
