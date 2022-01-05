import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, Replica } from '../architect/environment/environment.utils';
import Command from '../base-command';
import { ArchitectError, parseUnknownSlug, ServiceVersionSlugUtils } from '../dependency-manager/src';

export default class Logs extends Command {
  static description = 'Get logs from services';

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

    const { args, flags } = this.parse(Logs);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    let component_account_name: string | undefined;
    let component_name: string | undefined;
    let service_name: string | undefined;
    let tag: string | undefined;
    let instance_name: string | undefined;
    if (args.resource) {
      const parsed = parseUnknownSlug(args.resource);
      component_account_name = parsed.component_account_name;
      component_name = parsed.component_name;
      service_name = parsed.service_name;
      tag = parsed.tag;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      instance_name = parsed.instance_name; //TODO:534
    }

    const replica_query = {
      component_account_name,
      component_name,
      component_resource_name: service_name,
      component_tag: tag,
      component_instance_name: instance_name,
    };

    const { data: replicas }: { data: Replica[] } = await this.app.api.get(`/environments/${environment.id}/replicas`, {
      params: replica_query,
    });

    if (!replicas.length)
      throw new ArchitectError(`No replicas found for ${args.resource ? args.resource : 'environment'}`);

    const replica = await EnvironmentUtils.getReplica(replicas);

    const logs_query: any = {};
    logs_query.ext_ref = replica.ext_ref;
    logs_query.container = replica.node_ref;
    logs_query.follow = flags.follow;
    if (flags.since)
      logs_query.since = flags.since;
    if (flags.tail >= 0)
      logs_query.tail = flags.tail;
    logs_query.timestamps = flags.timestamps;

    const { data: log_stream } = await this.app.api.get(`/environments/${environment.id}/logs`, {
      params: logs_query,
      responseType: 'stream',
      timeout: 1000 * 60 * 60 * 24, // one day
    });

    let display_name = replica.display_name;
    if (!display_name) {
      const { service_name } = ServiceVersionSlugUtils.parse(replica.resource_ref);
      display_name = service_name;
    }

    // Stream logs
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(display_name))} ${chalk.hex('#D3D3D3')('|')}`;
    const columns = process.stdout.columns - (display_name.length + 3);

    let show_header = true;

    function chunkSubstring(str: string, size: number) {
      const numChunks = Math.ceil(str.length / size);
      const chunks = new Array(numChunks);

      for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = str.substring(o, o + size);
      }

      return chunks;
    }

    const displayRawLogs = flags.raw || !process.stdout.isTTY
    const log = (txt: string) => {
      if (displayRawLogs) {
        this.log(txt);
      } else {
        if (show_header) {
          this.log(chalk.bold(chalk.white('Logs:')));
          this.log(chalk.bold(chalk.white('―'.repeat(process.stdout.columns))));
          show_header = false;
        }
        for (const chunk of chunkSubstring(txt, columns)) {
          this.log(prefix, chalk.cyan(chunk));
        }
      }
    };

    let stdout = '';
    log_stream.on('data', (chunk: string) => {
      stdout += chunk;
      const lines = stdout.split('\n');
      while (lines.length > 1) {
        const line = lines.shift() || '';
        log(line);
      }
      stdout = lines.shift() || '';
    });
    log_stream.on('end', () => {
      if (stdout) {
        log(stdout);
      }
    });
  }
}
