import AppConfig from '../../app-config/config';
import BaseCommand from '../../base-command';
import InvalidConfigOption from '../../common/errors/invalid-config-option';

export default class ConfigGet extends BaseCommand {

  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Get the value of a CLI config option';

  static flags = {
    ...BaseCommand.flags,
  };

  static args = [{
    non_sensitive: true,
    name: 'option',
    required: true,
    description: 'Name of a config option',
  }];

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigGet);

    if (!Object.keys(this.app.config).includes(args.option)) {
      throw new InvalidConfigOption(args.option);
    }

    const value = this.app.config[args.option as keyof AppConfig];
    if (typeof value === 'string') {
      this.log(value);
    }
  }
}
