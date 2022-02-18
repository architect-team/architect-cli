import { Flags } from '@oclif/core';
import chalk from 'chalk';
import { spawn } from 'child_process';
import inquirer from 'inquirer';
import { Readable, Writable } from 'stream';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, Replica } from '../architect/environment/environment.utils';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { ArchitectError, parseUnknownSlug, ResourceVersionSlugUtils } from '../dependency-manager/src';

export default class Logs extends Command {
  static description = 'Get logs from services both locally and remote';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    follow: Flags.boolean({
      description: 'Specify if the logs should be streamed.',
      char: 'f',
      default: false,
    }),
    since: Flags.string({
      description: 'Only return logs newer than a relative duration like 5s, 2m, or 3h. Defaults to all logs. Only one of since-time / since may be used. Only works on remote deploys.',
      default: '',
    }),
    raw: Flags.boolean({
      description: 'Show the raw output of the logs.',
      default: false,
    }),
    tail: Flags.integer({
      description: 'Lines of recent log file to display. Defaults to -1 with no selector, showing all log lines otherwise 10, if a selector is provided.',
      default: -1,
    }),
    timestamps: Flags.boolean({
      description: 'Include timestamps on each line in the log output.',
      default: false,
    }),
  };

  static args = [{
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
    const { args, flags } = await this.parse(Logs);

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

    const display_service_name = service_name.substring(0, service_name.lastIndexOf('-'));
    let show_header = true;
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(display_service_name))} ${chalk.hex('#D3D3D3')('|')}`;

    const logger = new Writable();

    logger._write = (chunk, _encoding, next) => {
      chunk.toString().split('\n').filter((e: string) => e).forEach((line: string) => {
        if (!flags.raw && show_header) {
          this.log(chalk.bold(chalk.white('Logs:')));
          this.log(chalk.bold(chalk.white('―'.repeat(process.stdout.columns))));
          show_header = false;
        }
        if (!flags.raw) {
          line = line.substring(line.indexOf('|') + 1);
        }
        this.log(prefix, chalk.cyan(line));
      });
      next();
    };

    const childProcess = spawn('docker-compose', compose_args,
      { stdio: [process.stdin, null, process.stderr] });
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
    let tag: string | undefined;
    let instance_name: string | undefined;
    if (args.resource) {
      const parsed = parseUnknownSlug(args.resource);
      component_account_name = parsed.component_account_name;
      component_name = parsed.component_name;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      resource_name = parsed.resource_name;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      tag = parsed.tag;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      instance_name = parsed.instance_name; //TODO:534
    }

    const replica_query = {
      component_account_name,
      component_name,
      component_resource_name: resource_name,
      component_tag: tag,
      component_instance_name: instance_name,
    };

    let recovery_wait = 0;
    let started_prompts = false;
    const poll_interval = 2000;
    setInterval(async () => {
      if (!recovery_wait && !started_prompts) {
        started_prompts = true;
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

        let display_name = replica.display_name;
        if (!display_name) {
          const { resource_name } = ResourceVersionSlugUtils.parse(replica.resource_ref);
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
          recovery_wait = 15; // 2000ms * 15 = 30000 ms
          started_prompts = false;
        });
      } else if (recovery_wait > 0) {
        const recovery_seconds = recovery_wait * poll_interval / 1000;
        if (!(recovery_seconds % 10)) {
          this.log(chalk.yellow(`Log stream ended, attempting to recover in ${recovery_wait * poll_interval / 1000} seconds...`));
        }
        recovery_wait--;
      }
    }, poll_interval);
  }

  async run(): Promise<void> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { flags } = await this.parse(Logs);

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
