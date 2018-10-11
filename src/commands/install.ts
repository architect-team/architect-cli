import {Command, flags} from '@oclif/command';

export default class Install extends Command {
  static description = 'Install dependencies of the current service';

  static flags = {
    help: flags.help({char: 'h'}),
  };

  static args = [{
    name: 'dependency',
    description: 'Path to or name of a dependency to install'
  }];

  async run() {
    const {args, flags} = this.parse(Install);

    const dependency = args.dependency;
  }
}
