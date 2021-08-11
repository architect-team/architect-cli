import CliTable3 from 'cli-table3';
import Table from 'cli-table3';

const default_style: CliTable3.TableConstructorOptions = {
  style: {
    head: ['green']
  }
};

export default class BaseTable extends Table {
  constructor(opts: CliTable3.TableConstructorOptions) {
    super({ ...default_style, ...opts })
  }
}
