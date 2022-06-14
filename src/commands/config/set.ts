import AppConfig from '../../app-config/config';
import BaseCommand from '../../base-command';
import InvalidConfigOption from '../../common/errors/invalid-config-option';

export default class ConfigSet extends BaseCommand {

  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Set a new value for a CLI configuration option';

  static flags = {
    ...BaseCommand.flags,
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

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigSet);

    if (!Object.keys(this.app.config).includes(args.option)) {
      throw new InvalidConfigOption(args.option);
    }

    this.app.config[args.option as keyof AppConfig] = args.value;
    this.app.saveConfig();
    this.log(`Successfully updated ${args.option} to ${args.value}`);
  }
}
