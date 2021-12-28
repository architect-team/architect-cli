import { flags } from '@oclif/command';
import inquirer from 'inquirer';
import stream from 'stream';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import Command from '../base-command';

export default class Exec extends Command {
  static description = 'Exec into service instances';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    follow: flags.boolean({
      description: 'Specify if the logs should be streamed.',
      char: 'f',
      default: false,
    }),
    since: flags.string({
      description: 'Only return logs newer than a relative duration like 5s, 2m, or 3h. Defaults to all logs. Only one of since-time / since may be used.',
      default: '',
    }),
    raw: flags.boolean({
      description: 'Show the raw output of the logs.',
      default: false,
    }),
    tail: flags.integer({
      description: 'Lines of recent log file to display. Defaults to -1 with no selector, showing all log lines otherwise 10, if a selector is provided.',
      default: -1,
    }),
    timestamps: flags.boolean({
      description: 'Include timestamps on each line in the log output.',
      default: false,
    }),
  };

  static args = [{
    name: 'resource',
    description: 'Name of resource',
    required: false,
    parse: (value: string): string => value.toLowerCase(),
  }];

  async run(): Promise<void> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { args, flags } = this.parse(Exec);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const stdin = new stream.Readable();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    stdin._read = function () { };
    stdin.push(null);

    setTimeout(() => {
      stdin.push('woot!');
    }, 1000);

    const res = await this.app.api.post(`/environments/${environment.id}/test-exec`, stdin, {
      responseType: 'stream',
      timeout: 30000,
    });

    const exec_stream = res.data;

    exec_stream.on('data', (chunk: Buffer) => {
      console.log(chunk.toString());
    });

    exec_stream.on('end', (chunk: string) => {
      console.log('end');
    });
  }
}
