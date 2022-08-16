import { Flags, Interfaces } from '@oclif/core';
import { OutputArgs, OutputFlags } from '@oclif/core/lib/interfaces';
import chalk from 'chalk';
import inquirer from 'inquirer';
import stream from 'stream';
import WebSocket, { createWebSocketStream } from 'ws';
import { ArchitectError, Dictionary, parseUnknownSlug } from '../';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, Replica } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';

enum RemoteExecCommandOutputStatus {
  SUCCESS = 'Success',
  FAILURE = 'Failure',
}

interface RemoteExecCommandOutcome {
  metadata: Record<string, undefined>;
  status: RemoteExecCommandOutputStatus;
  message?: string;
  reason?: string;
  code?: number;
  details?: {
    causes?: Record<string, string>[];
  }
}

export default class Exec extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Exec into service instances';
  static usage = 'exec [RESOURCE] [FLAGS] -- [COMMAND]';
  static examples = [
    'architect exec -- ls',
    'architect exec -- /bin/sh',
    'architect exec --account myaccount --environment myenvironment mycomponent.services.app -- /bin/sh',
  ];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    stdin: Flags.boolean({
      description: 'Pass stdin to the container. Only works on remote deploys.',
      char: 'i',
      allowNo: true,
      default: true,
    }),
    tty: Flags.boolean({
      description: 'Stdin is a TTY. If the flag isn\'t supplied, tty or no-tty is automatically detected.',
      char: 't',
      allowNo: true,
      default: undefined,
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

  public static readonly StdinStream = 0;
  public static readonly StdoutStream = 1;
  public static readonly StderrStream = 2;
  public static readonly StatusStream = 3;

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const double_dash_index = argv.indexOf('--');
    if (double_dash_index === -1) {
      this.error(chalk.red('Command must be provided after --\n(e.g. "architect exec -- ls")'));
    }

    const command = argv.slice(double_dash_index + 1);
    if (command.length === 0) {
      this.error(chalk.red('Missing command argument following --'));
    }

    const argv_without_command = argv.slice(0, double_dash_index);

     const parsed = await super.parse(options, argv_without_command) as Interfaces.ParserOutput<F, A>;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    parsed.args.command = command;
    return parsed;
  }

  async exec(uri: string, flags: OutputFlags<typeof Exec['flags']>): Promise<void> {
    const ws = await this.getWebSocket(uri);

    await new Promise((resolve, reject) => {
      const websocket = createWebSocketStream(ws, { encoding: 'utf-8' });
      const inputTransform = this.getInputTransform();
      websocket.pipe(this.getOutputTransform());

      if (process.stdin.isTTY) {
        // This method is only available when stdin is a TTY as it's part of the tty.ReadStream class:
        // https://nodejs.org/api/tty.html#readstreamsetrawmodemode
        process.stdin.setRawMode(true);
        process.stdin.pipe(inputTransform).pipe(websocket);
      } else if (flags.stdin) {
        // If stdin is not a tty, stdin can be closed before data gets received by the websocket.
        // Passing {end: false} keeps the websocket open until it's closed when we receive the result.
        process.stdin.pipe(inputTransform, { end: false }).pipe(websocket);
      }

      websocket.on('end', () => {
        process.exit();
      });
      websocket.on('error', (err) => {
        reject(err);
      });
    });
  }

  async getWebSocket(uri: string): Promise<WebSocket> {
    const auth_result = await this.app.auth.getPersistedTokenJSON();
    return new Promise((resolve, reject) => {
      const protocols = ['v4.channel.k8s.io', 'v3.channel.k8s.io', 'v2.channel.k8s.io', 'channel.k8s.io'];

      const headers: Dictionary<string> = {
        Authorization: `${auth_result?.token_type} ${auth_result?.access_token}`,
      };

      const url = new URL(uri);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

      // Set HOST header for local dev
      if (url.hostname.endsWith('.localhost') && process.env.TEST !== '1') {
        headers.HOST = url.hostname;
        url.hostname = 'localhost';
      }

      const ws = new WebSocket(url.toString(), protocols, {
        handshakeTimeout: 5000,
        timeout: 10000,
        headers,
      });

      let resolved = false;

      ws.onopen = () => {
        resolved = true;
        resolve(ws);
      };

      ws.onerror = (err) => {
        if (!resolved) {
          reject(err);
        }
      };
    });
  }

  getOutputTransform(): stream.Transform {
    const transform = new stream.Transform();
    transform._transform = (data, encoding, done) => {
      if (data instanceof Buffer) {
        const stream_num = data.readInt8(0);

        const buffer = data.slice(1);

        if (buffer.length < 1) {
          return done(null, null);
        }

        if (stream_num === Exec.StdoutStream) {
          process.stdout.write(buffer);
        } else if (stream_num === Exec.StderrStream) {
          process.stderr.write(buffer);
        } else if (stream_num === Exec.StatusStream) {
          const outcome: RemoteExecCommandOutcome = JSON.parse(buffer?.toString('utf8'));
          if (outcome.status === RemoteExecCommandOutputStatus.FAILURE) {
            const exit_code_cause = outcome.details?.causes?.find(cause => cause.reason === 'ExitCode');
            const error_code = Number(exit_code_cause?.message || 1);
            // Triggers on an invalid command ex. `architect exec -- not-valid`
            if (outcome.message && outcome.reason !== 'NonZeroExitCode') {
              process.stderr.write(chalk.red(outcome.message) + '\n');
            }
            process.exit(error_code);
          }
        } else {
          return done(new ArchitectError(`Unknown stream type: ${stream_num}`));
        }

        return done(null, buffer);
      } else {
        return done(new ArchitectError(`Unknown data type: ${typeof data}`));
      }
    };
    return transform;
  }

  getInputTransform(): stream.Transform {
    const transform = new stream.Transform();
    transform._transform = (data, encoding, done) => {
      if (data instanceof Buffer) {
        const buffer = Buffer.alloc(data.length + 1);
        const stream_num = Exec.StdinStream;
        buffer.writeInt8(stream_num, 0);
        data.copy(buffer, 1);
        done(null, buffer);
      } else {
        done(new ArchitectError(`Unknown data type: ${typeof data}`));
      }
    };
    return transform;
  }

  async runRemote(account: Account, args: OutputArgs, flags: OutputFlags<typeof Exec['flags']>): Promise<void> {
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

    const { data: replicas }: { data: Replica[] } = await this.app.api.get(`/environments/${environment.id}/replicas`, {
      params: replica_query,
    });

    if (!replicas.length)
      throw new ArchitectError(`No replicas found for ${args.resource ? args.resource : 'environment'}`);

    const replica = await EnvironmentUtils.getReplica(replicas);

    const query = new URLSearchParams({
      ext_ref: replica.ext_ref,
      container: replica.node_ref,
    });

    if (flags.stdin && flags.tty) {
      query.append('stdin', 'true');
      // 'tty' should only be set true if both stdin and tty are set.
      // This mimics the behavior of `kubectl exec`.
      query.append('tty', 'true');
    } else if (flags.stdin) {
      query.append('stdin', 'true');
    }

    for (const arg of args.command) {
      query.append('command', arg);
    }

    const uri = `${this.app.config.api_host}/environments/${environment.id}/ws/exec?${query}`;
    await this.exec(uri, flags);
  }

  async runLocal(args: OutputArgs, flags: OutputFlags<typeof Exec['flags']>): Promise<void> {
    const environment_name = await DockerComposeUtils.getLocalEnvironment(this.app.config.getConfigDir(), flags.environment);
    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), environment_name);
    const service = await DockerComposeUtils.getLocalServiceForEnvironment(compose_file, args.resource);

    const compose_args = ['-f', compose_file, '-p', environment_name, 'exec'];
    // https://docs.docker.com/compose/reference/exec/
    if (!flags.tty || !process.stdout.isTTY) {
      compose_args.push('-T');
    }
    compose_args.push(service.name);

    for (const arg of args.command) {
      compose_args.push(arg);
    }

    await DockerComposeUtils.dockerCompose(compose_args, { stdio: 'inherit' }, true);
  }

  async run(): Promise<void> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { args, flags } = await this.parse(Exec);

    // Automatically set tty if the user doesn't supply it based on whether stdin is TTY.
    if (flags.tty === undefined) {
      // NOTE: stdin.isTTY is undefined if stdin is not a TTY, which is why this is a double negation.
      flags.tty = !!process.stdin.isTTY;
    } else if (flags.tty && !process.stdin.isTTY) {
      throw new ArchitectError('stdin does not support tty');
    }

    // If no account is default to local first.
    if (!flags.account && flags.environment) {
      // If the env exists locally then just assume local
      const is_local_env = await DockerComposeUtils.isLocalEnvironment(this.app.config.getConfigDir(), flags.environment);
      if (is_local_env) {
        return await this.runLocal(args, flags);
      }
    }

    // If no env is set then we don't know if this is local or remote so ask
    const account = await AccountUtils.getAccount(this.app, flags.account, { ask_local_account: !flags.environment });

    if (AccountUtils.isLocalAccount(account)) {
      return await this.runLocal(args, flags);
    }

    await this.runRemote(account, args, flags);
  }
}
