import { Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as net from 'net';
import { Transform } from 'stream';
import WebSocket, { createWebSocketStream } from 'ws';
import { ArchitectError, Dictionary, parseUnknownSlug } from '..';
import Account from '../architect/account/account.entity';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, GetEnvironmentOptions, Replica } from '../architect/environment/environment.utils';
import BaseCommand from '../base-command';
import PortUtil from '../common/utils/port';

export default class PortForward extends BaseCommand {
  static description = 'Port forward service to localhost';
  static usage = 'port-forward [RESOURCE] [FLAGS]';
  static examples = [
    'architect port-forward',
    'architect port-forward --account myaccount --environment myenvironment mycomponent.services.app',
    'architect port-forward --account myaccount --environment myenvironment mycomponent.services.app --replica 0',
    'architect port-forward --address 0.0.0.0 --port 8080',
  ];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    address: Flags.string({
      description: `Addresses to listen on. Only accepts IP addresses or localhost as a value.`,
      sensitive: false,
      default: 'localhost',
    }),
    port: Flags.integer({
      description: 'The port to listen on for the address provided.',
      sensitive: false,
    }),
    [`target-port`]: Flags.integer({
      description: 'The target port for the service.',
      sensitive: false,
    }),
    replica: Flags.integer({
      description: `Replica index for service. Only works on remote deploys.`,
      char: 'r',
      sensitive: false,
      min: 0,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'resource',
    description: 'Name of resource',
    required: false,
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  // These values correspond with the values defined in kubernetes remotecommand websocket handling:
  // https://github.com/kubernetes/kubernetes/blob/master/pkg/kubelet/cri/streaming/remotecommand/websocket.go#L30
  public static readonly StdinStream = 0;

  async portForward(uri: string, socket: net.Socket): Promise<void> {
    const ws = await this.getWebSocket(uri);

    await new Promise((resolve, reject) => {
      const websocket = createWebSocketStream(ws);

      const input_transform = new Transform({
        transform(chunk, encoding, callback) {
          const buff = Buffer.alloc(chunk.length + 1);
          buff.writeInt8(PortForward.StdinStream, 0);
          if (chunk instanceof Buffer) {
            chunk.copy(buff, 1);
          } else {
            buff.write(chunk, 1);
          }
          callback(null, buff);
        },
      });

      const capture_port: Dictionary<boolean | undefined> = {
        0: true,
        1: true,
      };

      const output_transform = new Transform({
        transform(chunk, encoding, callback) {
          if (!(chunk instanceof Buffer)) {
            callback(new Error('Not a buffer'));
          }
          const stream_num = chunk.readInt8(0) as number;
          chunk = chunk.slice(1);

          // First two bytes of each stream are the port number
          if (capture_port[stream_num]) {
            chunk = chunk.slice(2);
            capture_port[stream_num] = false;
            return callback();
          }

          if (stream_num % 2 === 1) {
            callback(new ArchitectError(chunk.toString()));
          } else {
            callback(null, chunk);
          }
        },
      });

      socket
        .pipe(input_transform)
        .pipe(websocket)
        .pipe(output_transform)
        .pipe(socket);

      websocket.on('error', (err) => {
        reject(err);
      });
    });
  }

  async getWebSocket(uri: string): Promise<WebSocket> {
    const auth_result = await this.app.auth.getPersistedTokenJSON();
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

    return ws;
  }

  async runRemote(account: Account): Promise<void> {
    const { args, flags } = await this.parse(PortForward);

    const get_environment_options: GetEnvironmentOptions = { environment_name: flags.environment };
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, get_environment_options);

    let component_name: string | undefined;
    let resource_name: string | undefined;
    let instance_name: string | undefined;

    if (args.resource) {
      const parsed = parseUnknownSlug(args.resource);
      component_name = parsed.component_name;
      resource_name = parsed.resource_name;
      instance_name = parsed.instance_name;
    }

    const replica_query = {
      component_name,
      component_resource_name: resource_name,
      component_instance_name: instance_name,
    };

    const { data: replicas }: { data: Replica[] } = await this.app.api.get(`/environments/${environment.id}/replicas`, {
      params: replica_query,
    });

    if (replicas.length === 0)
      throw new ArchitectError(`No replicas found for ${args.resource ? args.resource : 'environment'}`);

    const replica = await EnvironmentUtils.getReplica(replicas, flags.replica);

    if (replica.ports.length === 0) {
      throw new ArchitectError(`The service does not expose any ports to forward.`);
    }

    if (flags['target-port'] && !replica.ports.includes(flags['target-port'])) {
      throw new ArchitectError(`The target-port=${flags['target-port']} does not exist. Available ports are ${replica.ports}.`);
    }

    const target_port = flags['target-port'] || replica.ports[0];
    const query = new URLSearchParams({
      ext_ref: replica.ext_ref,
      port: target_port.toString(),
    });

    const uri = `${this.app.config.api_host}/environments/${environment.id}/ws/port-forward?${query}`;

    const server = net.createServer((socket) => {
      this.portForward(uri, socket).catch((err) => {
        console.error(err.message);
        socket.end();
      });
    });

    const port = flags.port || await PortUtil.getAvailablePort(40000);
    server.listen(port, flags.address);

    this.log(chalk.blue(`Forwarding from ${flags.address}:${port} -> ${target_port}`));
  }

  async run(): Promise<void> {
    // eslint-disable-next-line unicorn/prefer-module
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { flags } = await this.parse(PortForward);

    const account = await AccountUtils.getAccount(this.app, flags.account);

    await this.runRemote(account);
  }
}
