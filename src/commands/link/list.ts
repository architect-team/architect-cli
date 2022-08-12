import BaseCommand from '../../base-command';
import BaseTable from '../../base-table';

export default class ListLinkedComponents extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'List all linked components.';

  async run(): Promise<void> {
    const table = new BaseTable({ head: ['Component', 'Path'] });
    for (const entry of Object.entries(this.app.linkedComponents)) {
      table.push(entry);
    }
    this.log(table.toString());
  }
}
