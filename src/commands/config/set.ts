import Command from '../../base-command';
import InvalidConfigOption from '../../common/errors/invalid-config-option';

export default class ConfigSet extends Command {
  static description = 'Set a new value for a CLI configuration option';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'option',
    required: true,
    description: 'Name of a config option',
  }, {
    name: 'value',
    required: true,
    description: 'New value to assign to a config option',
  }];

  async run() {
    const {args} = this.parse(ConfigSet);

    if (!Object.keys(this.app.config).includes(args.option)) {
      throw new InvalidConfigOption(args.option);
    }

    this.app.config[args.option] = args.value;
    this.app.saveConfig();
    this.log(`Successfully updated ${args.option} to ${args.value}`);
  }
}
