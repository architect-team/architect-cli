import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import inquirer from 'inquirer';
import { Transform } from 'stream';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, Replica } from '../architect/environment/environment.utils';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { ArchitectError, parseUnknownSlug, ServiceVersionSlugUtils } from '../dependency-manager/src';

export default class Logs extends Command {
  static description = 'Get logs from services both locally and remote';

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
      description: 'Only return logs newer than a relative duration like 5s, 2m, or 3h. Defaults to all logs. Only one of since-time / since may be used. Only works on remote deploys.',
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

  private createLogger(display_name: string) {
    const { args, flags } = this.parse(Logs);
    const displayRawLogs = flags.raw || !process.stdout.isTTY;
    let show_header = true;
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(display_name))} ${chalk.hex('#D3D3D3')('|')}`;
    const columns = process.stdout.columns - (display_name.length + 3);

    function chunkSubstring(str: string, size: number) {
      const numChunks = Math.ceil(str.length / size);
      const chunks = new Array(numChunks);

      for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
        chunks[i] = str.substring(o, o + size);
      }

      return chunks;
    }

    return (txt: string) => {
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
  }

  async runLocal(): Promise<void> {
    const { args, flags } = this.parse(Logs);

    const environment_name = await DockerComposeUtils.getLocalEnvironment(this.app.config.getConfigDir(), flags.environment);
    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), environment_name);
    const service_name = await DockerComposeUtils.getLocalServiceForEnvironment(environment_name, compose_file, args.resource);

    const compose_args = ['-f', compose_file, '-p', environment_name, 'logs'];
    if (flags.follow) {
      compose_args.push('--follow');
    }
    if (flags.timestamps) {
      compose_args.push('--timestamps');
    }
    if (flags.tail != -1) {
      compose_args.push('--tail');
      compose_args.push(flags.tail.toString());
    }
    compose_args.push(service_name);

    const cmd = execa('docker-compose', compose_args);

    const logger = new Transform({
      decodeStrings: false,
    });

    const this_log = this.log;
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(service_name))} ${chalk.hex('#D3D3D3')('|')}`;
    logger._transform = function (chunk, _encoding, done) {
      chunk.toString().split('\n').forEach((line: string) => {
        if (!flags.raw) {
          line = line.substring(line.indexOf('|') + 1);
        }
        this_log(prefix, chalk.cyan(line));
      });
      done(null, chunk.toString());
    };

    cmd.stdin?.pipe(process.stdin);
    cmd.stdout?.pipe(logger);
    cmd.stderr?.pipe(process.stderr);

    await cmd;
  }

  async runRemote(account: Account): Promise<void> {
    const { args, flags } = this.parse(Logs);

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

    const log = this.createLogger(display_name);

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

  async run(): Promise<void> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { flags } = this.parse(Logs);

    // If no account is default to local first.
    if (!flags.account && flags.environment) {
      // If the env exists locally then just assume local
      const is_local_env = await DockerComposeUtils.isLocalEnvironment(this.app.config.getConfigDir(), flags.environment);
      if (is_local_env) {
        return await this.runLocal();
      }
    }

    // If no env is set then we don't know if this is local or remote so ask
    const account = await AccountUtils.getAccount(this.app, flags.account, undefined, !flags.environment);

    if (AccountUtils.isLocalAccount(account)) {
      return await this.runLocal();
    }

    await this.runRemote(account);
  }
}
