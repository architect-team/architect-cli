import { flags } from '@oclif/command';
import inquirer from 'inquirer';
import stream from 'stream';
import WebSocket, { createWebSocketStream } from 'ws';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, Replica } from '../architect/environment/environment.utils';
import Command from '../base-command';
import { ArchitectError, Dictionary, parseUnknownSlug } from '../dependency-manager/src';

export default class Exec extends Command {
  static description = 'Exec into service instances';
  static usage = 'exec [RESOURCE] [FLAGS] -- [COMMAND]';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    stdin: flags.boolean({
      description: 'Pass stdin to the container',
      char: 'i',
      allowNo: true,
      default: true,
    }),
    tty: flags.boolean({
      description: 'Stdin is a TTY',
      char: 't',
      allowNo: true,
      default: true,
    }),
  };

  static args = [{
    name: 'command',
    description: 'Command to run',
    required: true,
  }, {
    name: 'resource',
    description: 'Name of resource',
    required: false,
    parse: (value: string): string => value.toLowerCase(),
  }];

  public static readonly StdinStream = 0;
  public static readonly StdoutStream = 1;
  public static readonly StderrStream = 2;
  public static readonly StatusStream = 3;

  async run(): Promise<void> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { args, flags } = this.parse(Exec);

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

    const query = new URLSearchParams({
      ext_ref: replica.ext_ref,
      container: replica.node_ref,
      stdin: flags.stdin.toString(),
      tty: flags.tty.toString(),
    });
    for (const c of args.command.split(' ')) {
      query.append('command', c);
    }

    const uri = `${this.app.config.api_host}/environments/${environment.id}/ws/exec?${query}`;
    await this.exec(uri);
  }

  async exec(uri: string): Promise<void> {
    const { args, flags } = this.parse(Exec);

    const ws = await this.getWebSocket(uri);

    await new Promise((resolve, reject) => {
      const duplex = createWebSocketStream(ws, { encoding: 'utf-8' });
      duplex.pipe(this.getOutputTransform());

      if (flags.stdin) {
        if (flags.tty && !process.stdin.isTTY) {
          throw new ArchitectError('stdin does not support tty');
        }
        process.stdin.setRawMode(true);
        process.stdin.pipe(this.getInputTransform()).pipe(duplex);
      }

      duplex.on('end', () => {
        process.exit();
      });
      duplex.on('error', (err) => {
        reject(err);
      });
    });
  }

  async getWebSocket(uri: string): Promise<WebSocket> {
    const auth_result = await this.app.auth.getPersistedTokenJSON();
    return new Promise((resolve, reject) => {
      const protocols = ['v4.channel.k8s.io', 'v3.channel.k8s.io', 'v2.channel.k8s.io', 'channel.k8s.io'];

      const headers: Dictionary<string> = {
        Authorization: `Bearer ${auth_result?.access_token}`,
      };

      const url = new URL(uri);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

      // Set HOST header for local dev
      if (url.hostname.endsWith('.localhost') && process.env.NODE_ENV !== 'test') {
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
          const status = JSON.parse(buffer.toString('utf8'));
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
}