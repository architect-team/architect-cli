import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { spawn } from 'child_process';
import inquirer from 'inquirer';
import { Readable, Writable } from 'stream';
import { ArchitectError, parseUnknownSlug, ResourceSlugUtils } from '../';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import Environment from '../architect/environment/environment.entity';
import { EnvironmentUtils, Replica } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { RequiresDocker } from '../common/docker/helper';
import { booleanString } from '../common/utils/oclif';

function chunkSubstring(str: string, size: number) {
  const numChunks = Math.ceil(str.length / size);
  // eslint-disable-next-line unicorn/no-new-array
  const chunks = new Array(numChunks);

  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substring(o, o + size);
  }

  return chunks;
}

export default class Logs extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Get logs from services both locally and remote';
  static examples = [
    'architect logs',
    'architect logs --follow --raw --timestamps',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    follow: booleanString({
      description: 'Specify if the logs should be streamed.',
      char: 'f',
      default: false,
      sensitive: false,
    }),
    since: Flags.string({
      description: 'Only return logs newer than a relative duration like 5s, 2m, or 3h. Defaults to all logs. Only one of since-time / since may be used.',
      default: '',
      sensitive: false,
    }),
    raw: booleanString({
      description: 'Show the raw output of the logs.',
      default: false,
      sensitive: false,
    }),
    tail: Flags.integer({
      description: 'Lines of recent log file to display. Defaults to -1 with no selector, showing all log lines otherwise 10, if a selector is provided.',
      default: -1,
      sensitive: false,
    }),
    timestamps: booleanString({
      description: 'Include timestamps on each line in the log output.',
      default: false,
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'resource',
    description: 'Name of resource',
    required: false,
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  private async createLogger(display_name: string) {
    const { args, flags } = await this.parse(Logs);
    const displayRawLogs = flags.raw || !process.stdout.isTTY;
    let show_header = true;
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(display_name))} ${chalk.hex('#D3D3D3')('|')}`;
    const columns = process.stdout.columns - (display_name.length + 3);

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

  @RequiresDocker({ compose: true })
  async runLocal(): Promise<void> {
    const { args, flags } = await this.parse(Logs);

    const environment_name = await DockerComposeUtils.getLocalEnvironment(this.app.config.getConfigDir(), flags.environment);
    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), environment_name);
    const service = await DockerComposeUtils.getLocalServiceForEnvironment(compose_file, args.resource);

    const compose_args = ['-f', compose_file, '-p', environment_name, 'logs'];
    if (flags.follow) {
      compose_args.push('--follow');
    }
    if (flags.timestamps) {
      compose_args.push('--timestamps');
    }
    if (flags.tail !== -1) {
      compose_args.push('--tail', flags.tail.toString());
    }
    if (flags.since !== '') {
      compose_args.push('--since', flags.since.toString());
    }
    compose_args.push(service.name);

    let show_header = true;
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(service.display_name))} ${chalk.hex('#D3D3D3')('|')}`;

    const logger = new Writable();

    logger._write = (chunk, _encoding, next) => {
      for (let line of chunk.toString().split('\n').filter((e: string) => e)) {
        if (!flags.raw && show_header) {
          this.log(chalk.bold(chalk.white('Logs:')));
          this.log(chalk.bold(chalk.white('―'.repeat(process.stdout.columns))));
          show_header = false;
        }
        if (!flags.raw) {
          line = line.substring(line.indexOf('|') + 1);
        }
        this.log(prefix, chalk.cyan(line));
      }
      next();
    };

    const childProcess = spawn('docker', ['compose', ...compose_args], { stdio: [process.stdin, null, process.stderr] });
    (childProcess.stdout as Readable).pipe(logger);

    await new Promise((resolve) => {
      childProcess.on('close', resolve);
    });
  }

  async runRemote(account: Account): Promise<void> {
    const { args, flags } = await this.parse(Logs);

    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    let component_account_name: string | undefined;
    let component_name: string | undefined;
    let resource_name: string | undefined;
    let instance_name: string | undefined;
    if (args.resource) {
      const parsed = parseUnknownSlug(args.resource);
      component_account_name = parsed.component_account_name;
      component_name = parsed.component_name;
      resource_name = parsed.resource_name;
      instance_name = parsed.instance_name;
    }

    const replica_query = {
      component_account_name,
      component_name,
      component_resource_name: resource_name,
      component_instance_name: instance_name,
    };

    await this.runRemoteLogs(environment, replica_query);
  }

  async runRemoteLogs(environment: Environment, replica_query: any): Promise<void> {
    const { args, flags } = await this.parse(Logs);

    const { data: replicas }: { data: Replica[] } = await this.app.api.get(`/environments/${environment.id}/replicas`, {
      params: replica_query,
    });

    if (replicas.length === 0)
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

    let display_name = replica.display_name;
    if (!display_name) {
      const { resource_name } = ResourceSlugUtils.parse(replica.resource_ref);
      display_name = resource_name;
    }

    const log = await this.createLogger(display_name);

    let log_stream;
    try {
      const { data: stream } = await this.app.api.get(`/environments/${environment.id}/logs`, {
        params: logs_query,
        responseType: 'stream',
        timeout: 1000 * 60 * 60 * 24, // one day
      });
      log_stream = stream;
    } catch (err) {
      this.error(chalk.red(`Couldn't get logs from pod ${replica.ext_ref}. Check that the pod is in a steady state.`));
    }

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
    log_stream.on('end', async () => {
      if (stdout) {
        log(stdout);
      }
      if (flags.follow) {
        // Attempt to reconnect in 30s
        this.log(chalk.yellow(`Log stream ended, attempting to recover in 30 seconds...`));
        setTimeout(() => {
          this.log(chalk.yellow(`Log stream ended, attempting to recover in 20 seconds...`));
        }, 1000 * 10);
        setTimeout(() => {
          this.log(chalk.yellow(`Log stream ended, attempting to recover in 10 seconds...`));
        }, 1000 * 20);
        setTimeout(() => {
          this.runRemoteLogs(environment, replica_query);
        }, 1000 * 30);
      }
    });
  }

  async run(): Promise<void> {
    // eslint-disable-next-line unicorn/prefer-module
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { flags } = await this.parse(Logs);

    // If no account is default to local first.
    if (!flags.account && flags.environment) {
      // If the env exists locally then just assume local
      const is_local_env = await DockerComposeUtils.isLocalEnvironment(flags.environment);
      if (is_local_env) {
        return this.runLocal();
      }
    }

    // If no env is set then we don't know if this is local or remote so ask
    const account = await AccountUtils.getAccount(this.app, flags.account, { ask_local_account: !flags.environment });

    if (AccountUtils.isLocalAccount(account)) {
      return this.runLocal();
    }

    await this.runRemote(account);
  }
}
