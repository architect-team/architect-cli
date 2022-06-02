import AppConfig from '../../app-config/config';
import Command from '../../base-command';
import InvalidConfigOption from '../../common/errors/invalid-config-option';

export default class ConfigGet extends Command {
  static is_sensitive = true;
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Get the value of a CLI config option';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'option',
    required: true,
    description: 'Name of a config option',
  }];

  async run(): Promise<void> {
    try {
      const { args } = await this.parse(ConfigGet);

      if (!Object.keys(this.app.config).includes(args.option)) {
        throw new InvalidConfigOption(args.option);
      }

      const value = this.app.config[args.option as keyof AppConfig];
      if (typeof value === 'string') {
        this.log(value);
      }
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack?.substring(6);
        if (cli_stacktrace) {
          e.stack += `\n    at${cli_stacktrace}`;
        }
      }
      throw e;
    }
  }
}
