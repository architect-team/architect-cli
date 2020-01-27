import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import Command from '../../base-command';

export default class EnvironmentUpdate extends Command {
  static aliases = ['environment:update', 'envs:update', 'env:update'];
  static description = 'Update an environments configuration';

  static flags = {
    ...Command.flags,
    description: flags.string({ char: 'd' }),
  };

  static args = [{
    name: 'namespaced_environment',
    description: 'Name of the environment to update',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentUpdate);

    const [account_name, env_name] = args.namespaced_environment.split('/');
    if (!account_name || !env_name) {
      throw new Error(`Please specify a namespaced environment in the form <account_name>/<environment_name>`);
    }

    const account = (await this.app.api.get(`/accounts/${account_name}`)).data;

    cli.action.start(chalk.blue('Updating environment'));
    const { data: account_environment } = await this.app.api.get(`/accounts/${account.id}/environments/${env_name}`);
    const answers = { ...args, ...flags };

    await this.app.api.put(`/environments/${account_environment.id}`, {
      description: answers.description,
    });
    cli.action.stop(chalk.green('Environment updated successfully'));
  }
}
