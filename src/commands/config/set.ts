import AppConfig from '../../app-config/config';
import Command from '../../base-command';
import InvalidConfigOption from '../../common/errors/invalid-config-option';

export default class ConfigSet extends Command {

  async auth_required(): Promise<boolean> {
    return false;
  }

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

  static sensitive = new Set([...Object.keys({ ...this.flags }), ...this.args.map(arg => arg.name)]);

  static non_sensitive = new Set();

  async run(): Promise<void> {
    try {
      const { args } = await this.parse(ConfigSet);

      if (!Object.keys(this.app.config).includes(args.option)) {
        throw new InvalidConfigOption(args.option);
      }

      this.app.config[args.option as keyof AppConfig] = args.value;
      this.app.saveConfig();
      this.log(`Successfully updated ${args.option} to ${args.value}`);
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }
}
