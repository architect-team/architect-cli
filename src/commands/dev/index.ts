import { Flags, Interfaces } from '@oclif/core';
import axios from 'axios';
import chalk from 'chalk';
import { ExecaChildProcess } from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import isCi from 'is-ci';
import yaml from 'js-yaml';
import net from 'net';
import opener from 'opener';
import path from 'path';
import { ArchitectError, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils, Dictionary } from '../../';
import Account from '../../architect/account/account.entity';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import SecretUtils from '../../architect/secret/secret.utils';
import { default as BaseCommand } from '../../base-command';
import LocalDependencyManager, { ComponentConfigOpts } from '../../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../../common/docker-compose';
import DockerComposeTemplate from '../../common/docker-compose/template';
import { RequiresDocker } from '../../common/docker/helper';
import DeployUtils from '../../common/utils/deploy.utils';
import { booleanString } from '../../common/utils/oclif';
import PortUtil from '../../common/utils/port';
import { SecretsDict } from '../../dependency-manager/secrets/type';
import { buildSpecFromPath } from '../../dependency-manager/spec/utils/component-builder';
import LocalPaths from '../../paths';

type TraefikHttpService = {
  name: string;
  status: string;
  serverStatus?: Dictionary<string>;
  provider: string;
};

const HOST_REGEX = new RegExp(/Host\(`(.*?)`\)/);

const rand = () => Math.floor(Math.random() * 255);
const onlyUnique = <T>(value: T, index: number, self: T[]) => self.indexOf(value) === index;

/**
 * Converts a regular filepath into a path that is valid for a Windows socket
 * See https://nodejs.org/api/net.html#ipc-support for info.
 */
export function socketPath(path: string): string {
  if (process.platform === 'win32') {
    path = path.replace(/^\//, '');
    path = path.replace(/\//g, '-');
    path = `\\\\.\\pipe\\${path}`;
  }
  return path;
}

/**
 * Handles the logic for managing the `docker compose up` process.
 *
 * Gracefully stops running containers when the process is interrupted, and
 * stops containers when the underlying process returns with an error.
 */
export class UpProcessManager {
  compose_file: string;
  server?: net.Server;
  socket: string;
  project_name: string;
  detached: boolean;
  is_windows: boolean;

  compose_process?: ExecaChildProcess<string>;
  is_exiting: boolean;
  can_safely_kill: boolean;

  constructor(compose_file: string, socket: string, project_name: string, detached: boolean) {
    this.compose_file = compose_file;
    this.socket = socket;
    this.project_name = project_name;
    this.detached = detached;

    this.is_windows = process.platform === 'win32';
    this.is_exiting = false;
    this.can_safely_kill = false;
  }

  /** Spawns a process running `docker compose up` */
  start(): ExecaChildProcess<string> {
    const compose_args = ['-f', this.compose_file, '-p', this.project_name, 'up', '--remove-orphans', '--renew-anon-volumes', '--timeout', '0'];
    if (this.detached) {
      compose_args.push('-d');
    }

    // `detached: true` is set for non-windows platforms so that the SIGINT isn't automatically sent to
    // the `docker compose` process. Signals are automatically sent to the entire process group, but we want to
    // handle SIGINT in a special way in `handleInterrupt`.
    // On Windows (cmd, powershell), signals don't exist and running in detached mode opens a new window. The
    // "SIGINT" we get on Windows isn't a real signal and isn't automatically passed to child processes,
    // so we don't have to worry about it.
    const compose_process = DockerComposeUtils.dockerCompose(compose_args,
      { stdout: 'pipe', stdin: 'ignore', detached: !this.is_windows });

    this.server = net.createServer();
    this.server.on('connection', (socket) => {
      socket.on('data', (d) => {
        if (d.toString('utf-8') === 'stop') {
          this.handleInterrupt();
        }
      });
    });

    let recreated_socket = false;
    this.server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE' && this.server && !recreated_socket) {
        recreated_socket = true;
        // Socket already exists (likely from a previous run that didnt get cleaned up properly)
        // Remove it and listen again creating a new socket.
        fs.rmSync(this.socket);
        this.server.listen(this.socket);
      } else {
        throw e;
      }
    });

    this.server.listen(this.socket);

    return compose_process;
  }

  /** Spawns a process running `docker compose stop`  */
  async stop(): Promise<void> {
    await DockerComposeUtils.dockerCompose(['-f', this.compose_file, '-p', this.project_name, 'stop'], { detached: !this.is_windows });
  }

  /** Sends the SIGINT signal to the running `docker compose up` process. */
  interrupt(): void {
    if (!this.compose_process) {
      throw new Error('Must call run() first');
    }
    process.kill(-this.compose_process.pid, 'SIGINT');
  }

  configureInterrupts(): void {
    process.on('SIGINT', () => {
      this.handleInterrupt();
    });

    // This is what happens with Ctrl+Break on Windows. Treat it like a Ctrl+C, otherwise
    // the user can kill `architect dev` in a "normal" way without the containers stopping.
    process.on('SIGBREAK', () => {
      this.handleInterrupt();
    });
  }

  async handleInterrupt(): Promise<void> {
    // If a user SIGINT's between when docker compose outputs "Attaching to ..." and starts printing logs,
    // the containers will not be stopped and `docker compose stop` won't yet work.
    // We stop SIGINT from doing anything until we know for sure we can stop gracefully.
    if (this.is_exiting || !this.can_safely_kill) {
      return;
    }
    this.is_exiting = true;
    console.log('Gracefully stopping..... Please Wait.....');
    // On non-windows, we can just interrupt the compose process. On windows, we need to run 'stop' to
    // ensure the containers are stopped.
    if (this.is_windows) {
      this.stop();
    } else {
      this.interrupt();
    }
  }

  /**
   * Handles printing logs from the attached docker images.
   * Stops printing logs once `handleInterrupt` is called and containers are being stopped.
   */
  configureLogs(): void {
    if (!this.compose_process) {
      throw new Error('Must call run() first');
    }

    const service_colors = new Map<string, chalk.Chalk>();
    this.compose_process.stdout?.on('data', (data) => {
      if (this.is_exiting) {
        return;
      }

      for (const line of data.toString().split('\n')) {
        const lineParts = line.split('|');
        if (lineParts.length > 1) {
          // At this point we can stop the process without leaving containers running.
          this.can_safely_kill = true;
          const service = (lineParts[0] as string).replace(`${this.project_name}-`, '');

          lineParts.shift();
          const newLine = lineParts.join('|');

          if (!service_colors.get(service)) {
            service_colors.set(service, chalk.rgb(rand(), rand(), rand()));
          }

          const color = service_colors.get(service) as chalk.Chalk;
          console.log(color(service + '| ') + newLine);
        }
      }
    });
  }

  async run(): Promise<void> {
    this.compose_process = this.start();

    this.configureInterrupts();
    this.configureLogs();

    const container_health = DockerComposeUtils.watchContainersHealth(this.compose_file, this.project_name, () => {
      return this.is_exiting;
    });

    try {
      await this.compose_process;
    } catch (ex) {
      if (!this.is_exiting) {
        // Always call `docker compose stop` here - the process died so there's nothing to kill,
        // need to call `docker compose stop` to clean up any remaining running containers.
        console.error(chalk.red(ex));
        console.log(chalk.red('\nError detected - Stopping running containers...'));
        this.is_exiting = true;
        await this.stop();
      }
    } finally {
      if (this.server) {
        this.server.close();
      }
      // Mark that we're exiting - in the case that the compose procesas is stopped by the `architect stop` command,
      // this won't be set, but we do need it to be true so watchContainersHealth exits as desired
      this.is_exiting = true;
      // If the process is interrupted or dies of some other means _right after_ a container was restarted,
      // we can end up in a state where that singular container is still running and the others have been stopped.
      // This checks for that case and will call `docker compose stop` if it happened to ensure the container is taken down.
      const restarted = await container_health;
      if (restarted) {
        await this.stop();
      }
    }
  }
}

export default class Dev extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Run your stack locally';

  static examples = [
    'architect dev ./mycomponent/architect.yml',
    'architect dev ./mycomponent/architect.yml -a myaccount --secrets-env=myenvironment',
    'architect dev --port=81 --browser=false --debug=true --secret-file=./mycomponent/mysecrets.yml ./mycomponent/architect.yml',
  ];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    'compose-file': Flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['environment'],
      sensitive: false,
    }),
    parameter: Flags.string({
      char: 'p',
      description: `Please use --secret.`,
      multiple: true,
      hidden: true,
      deprecated: {
        to: 'secret',
      },
    }),
    interface: Flags.string({
      char: 'i',
      description: 'Deprecated: Please use ingress.subdomain https://docs.architect.io/components/ingress-rules/',
      multiple: true,
      default: undefined,
      sensitive: false,
      deprecated: true,
      hidden: true,
    }),
    'secrets-env': Flags.string({
      description: 'Environment to load secrets from [beta]',
      hidden: true,
    }),
    'secret-file': Flags.string({
      description: 'Path of secrets file',
      multiple: true,
      default: [],
    }),
    secrets: Flags.string({
      description: `Please use --secret-file.`,
      multiple: true,
      hidden: true,
      deprecated: {
        to: 'secret-file',
      },
    }),
    secret: Flags.string({
      char: 's',
      description: 'An individual secret key and value in the form SECRET_KEY=SECRET_VALUE',
      multiple: true,
      default: [],
    }),
    recursive: booleanString({
      char: 'r',
      default: true,
      description: '[default: true] Toggle to automatically deploy all dependencies',
      sensitive: false,
    }),
    browser: booleanString({
      default: true,
      description: '[default: true] Automatically open urls in the browser for local deployments',
      sensitive: false,
    }),
    port: Flags.integer({
      description: '[default: 443] Port for the gateway',
      sensitive: false,
    }),
    // Used for proxy from deploy to dev. These will be removed once --local is deprecated
    local: booleanString({
      char: 'l',
      description: `Deploy the stack locally instead of via Architect Cloud`,
      exclusive: ['account', 'auto-approve'],
      hidden: true,
      sensitive: false,
      default: undefined,
      deprecated: true,
    }),
    production: booleanString({
      description: `Please use --environment.`,
      dependsOn: ['local'],
      hidden: true,
      sensitive: false,
      default: undefined,
      deprecated: {
        to: 'environment',
      },
    }),
    compose_file: Flags.string({
      description: `Please use --compose-file.`,
      exclusive: ['account', 'environment'],
      hidden: true,
      sensitive: false,
      deprecated: {
        to: 'compose-file',
      },
    }),
    values: Flags.string({
      char: 'v',
      hidden: true,
      description: `Please use --secret-file.`,
      deprecated: {
        to: 'secret-file',
      },
    }),
    detached: booleanString({
      description: 'Run in detached mode',
      char: 'd',
      sensitive: false,
      default: false,
    }),
    debug: booleanString({
      description: `[default: true] Turn debug mode on (true) or off (false)`,
      default: true,
      sensitive: false,
    }),
    arg: Flags.string({
      description: 'Build arg(s) to pass to docker build',
      multiple: true,
    }),
    ssl: booleanString({
      description: 'Use https for all ingresses',
      default: true,
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    if (!options) {
      return super.parse(options, argv);
    }
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    if (parsed.argv.length > 0) {
      parsed.args.configs_or_components = parsed.argv;
    } else {
      parsed.args.configs_or_components = ['./architect.yml'];
    }

    parsed.flags = DeployUtils.parseFlags(parsed.flags);

    return parsed;
  }

  async healthyTraefikServices(admin_port: number, timeout: number): Promise<TraefikHttpService[]> {
    const { data: services } = await axios.get<TraefikHttpService[]>(`http://localhost:${admin_port}/api/http/services`, {
      timeout,
    });
    const healthy_services = services.filter((service) => {
      if (service.status !== 'enabled') return false;
      if (!service.serverStatus) return false;
      if (service.provider !== 'docker') return false;
      return Object.values(service.serverStatus).includes('UP');
    });
    return healthy_services;
  }

  setupTraefikServiceMap(compose: DockerComposeTemplate, gateway_port: number, ssl: boolean): Dictionary<string | undefined> {
    this.log('Once the containers are running they will be accessible via the following urls:');

    const protocol = ssl ? 'https' : 'http';
    const traefik_service_map: Dictionary<string | undefined> = {};
    for (const [service_name, service] of Object.entries(compose.services)) {
      if (service.labels?.includes('traefik.enable=true')) {
        const host_rules = service.labels.filter(label => label.includes('rule=Host'));
        for (const host_rule of host_rules) {
          const host_match = HOST_REGEX.exec(host_rule);
          if (host_match) {
            const url = `${protocol}://${host_match[1]}:${gateway_port}/`;
            this.log(`${chalk.blue(url)} => ${service_name}`);

            const traefik_service = host_rule.split('.')[3];
            traefik_service_map[`${traefik_service}-service@docker`] = url;
          }
        }
      }
    }
    this.log('');

    for (const svc_name of Object.keys(compose.services)) {
      for (const port_pair of compose.services[svc_name].ports || []) {
        const [exposed_port, internal_port] = port_pair && (port_pair as string).split(':');
        this.log(`${chalk.blue(`http://localhost:${exposed_port}/`)} => ${svc_name}:${internal_port}`);
      }
    }

    return traefik_service_map;
  }

  async pollTraefik(admin_port: number, traefik_service_map: Dictionary<string | undefined>): Promise<void> {
    const poll_interval = 5000;
    let open_browser_attempts = 0;

    const unique_urls = new Set(Object.values(traefik_service_map));

    const seen_urls = new Set();
    const browser_interval = setInterval(async () => {
      if (open_browser_attempts > 120 || seen_urls.size >= unique_urls.size) {
        clearInterval(browser_interval);
        return;
      }
      const healthy_services = await this.healthyTraefikServices(admin_port, poll_interval).catch(() => []);
      for (const healthy_service of healthy_services) {
        const url = traefik_service_map[healthy_service.name];
        if (url && !seen_urls.has(url)) {
          this.log('Opening', chalk.blue(url));
          opener(url);
          if (seen_urls.size === 0) {
            this.log('(disable with --browser=false)');
          }
          seen_urls.add(url);
        }
      }
      open_browser_attempts++;
    }, poll_interval);
  }

  async buildImage(compose: DockerComposeTemplate, default_project_name: string): Promise<[string, string]> {
    const { flags } = await this.parse(Dev);

    const project_name = await DockerComposeUtils.getProjectName(default_project_name);
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, yaml.dump(compose));
    this.log(`Wrote docker-compose file to: ${compose_file}`);

    const args = flags.arg || [];

    const build_args = [];
    for (const arg of args) {
      const [key, value] = arg.split(/=([^]+)/);
      if (!value) {
        throw new Error(`--arg must be in the format key=value: ${arg}`);
      }
      build_args.push('--build-arg', arg);
    }

    try {
      await DockerComposeUtils.dockerCompose(['-f', compose_file, '-p', project_name, 'build', ...build_args], { stdin: 'inherit', stdout: 'inherit', stderr: 'pipe' });
    } catch (e: any) {
      if (e.exitCode !== 0) {
        this.logToStderr(chalk.red('Docker compose has encounted an error building the specified image:'));
        throw new ArchitectError(e.stderr);
      }
    }
    return [project_name, compose_file];
  }

  async runCompose(compose: DockerComposeTemplate, default_project_name: string, gateway_port: number, gateway_admin_port: number): Promise<void> {
    const { flags } = await this.parse(Dev);
    const [project_name, compose_file] = await this.buildImage(compose, default_project_name);
    const socket = socketPath(path.join(this.app.config.getConfigDir(), LocalPaths.LOCAL_DEPLOY_PATH, project_name));

    this.log('Building containers...', chalk.green('done'));
    this.log('');

    const traefik_service_map = this.setupTraefikServiceMap(compose, gateway_port, flags.ssl);

    this.log('');
    this.log('Starting containers...');
    this.log('');

    if (!isCi && flags.browser && Object.keys(traefik_service_map).length > 0) {
      this.pollTraefik(gateway_admin_port, traefik_service_map);
    }

    await new UpProcessManager(compose_file, socket, project_name, flags.detached).run();
    if (!flags.detached) {
      fs.removeSync(compose_file);
    }
    // eslint-disable-next-line no-process-exit
    process.exit();
  }

  private async getAvailablePort(port: number): Promise<number> {
    while (!(await PortUtil.isPortAvailable(port))) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'port',
          message: `Trying to listen on port ${port}, but something is already using it. What port would you like us to run the API gateway on (you can use the '--port' flag to skip this message in the future)?`,
          validate: (value) => {
            if (new RegExp('^[1-9]+\\d*$').test(value)) {
              return true;
            }
            return `Port can only be positive number.`;
          },
        },
      ]);

      port = answers.port;
    }
    return port;
  }

  private async downloadFileAndCache(url: string, output_location: string): Promise<void> {
    const handleReject = (resolve: () => void, reject: () => void) => {
      // These file operations can be sync due to failure state
      if (!fs.existsSync(output_location)) {
        return reject();
      }
      // If the file is not too old than we can use it instead
      const stats = fs.statSync(output_location);
      const diff_in_ms = Math.abs(stats.mtime.getTime() - Date.now());
      const days = diff_in_ms / (1000 * 60 * 60 * 24);
      if (days > 30) {
        reject();
      } else {
        resolve();
      }
    };
    return new Promise((resolve, reject) => {
      axios({
        method: 'get',
        url: url,
        timeout: 10000, // 10 seconds
        responseType: 'stream',
      }).then((response) => {
        if (response.status > 399) {
          return handleReject(resolve, reject);
        }
        let file_contents = '';
        response.data.on('data', (chunk: Buffer) => {
          file_contents += chunk.toString();
        });
        response.data.on('end', () => {
          fs.writeFileSync(output_location, file_contents);
          resolve();
        });
        response.data.on('error', () => {
          return handleReject(resolve, reject);
        });
      }).catch(err => {
        return handleReject(resolve, () => {
          reject(err);
        });
      });
    });
  }

  private async downloadSSLCerts() {
    return Promise.all([
      this.downloadFileAndCache('https://storage.googleapis.com/architect-ci-ssl/fullchain.pem', path.join(this.app.config.getConfigDir(), 'fullchain.pem')),
      this.downloadFileAndCache('https://storage.googleapis.com/architect-ci-ssl/privkey.pem', path.join(this.app.config.getConfigDir(), 'privkey.pem')),
    ]).catch((err) => {
      this.warn(chalk.yellow('We are unable to download the neccessary ssl certificates. Please try again or use --ssl=false to temporarily disable ssl'));
      this.error(new ArchitectError(err.message));
    });
  }

  private readSSLCert(file: string) {
    return fs.readFileSync(path.join(this.app.config.getConfigDir(), file)).toString();
  }

  private async failIfEnvironmentExists(environment: string) {
    const running_envs = await DockerComposeUtils.getLocalEnvironments();
    if (running_envs.includes(environment)) {
      this.log(chalk.red(`The environment \`${environment}\` is already running.`));
      this.log(chalk.yellow(`To see a list of your currently running environments you can run
$ architect dev:list

To stop the currently running environments you can run
$ architect dev:stop ${environment}

To continue running the other environment and create a new one you can run the \`dev\` command with the \`-e\` flag
$ architect dev -e new_env_name_here .`));
      this.error(new ArchitectError('Environment name already in use.'));
    }
  }

  private async getEnvironmentSecrets(account: Account, environment_name: string, cluster_name?: string): Promise<SecretsDict> {
    const secrets = await SecretUtils.getSecrets(this.app, account, { cluster_name, environment_name }, true);

    const env_secrets: SecretsDict = {};
    for (const secret of secrets) {
      env_secrets[secret.scope] = env_secrets[secret.scope] || {};
      env_secrets[secret.scope][secret.key] = secret.value;
    }
    return env_secrets;
  }

  private async runLocal() {
    const { args, flags } = await this.parse(Dev);

    const environment = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    await this.failIfEnvironmentExists(environment);

    flags.port = await this.getAvailablePort(flags.port || (flags.ssl ? 443 : 80));

    if (flags.ssl) {
      await this.downloadSSLCerts();
    }

    const interfaces_map = DeployUtils.getInterfacesMap(flags.interface || []);

    let env_secrets: SecretsDict = {};
    if (flags['secrets-env']) {
      const account = await AccountUtils.getAccount(this.app, flags.account, { ask_local_account: false });
      env_secrets = await this.getEnvironmentSecrets(account, flags['secrets-env']);
    }

    const all_secret_file_values = [...(flags['secret-file'] || []), ...(flags.secrets || [])]; // TODO: 404: remove
    const component_secrets = DeployUtils.getComponentSecrets(flags.secret, all_secret_file_values, env_secrets);
    const component_parameters = DeployUtils.getComponentSecrets(flags.parameter || [], all_secret_file_values);

    const linked_components = this.app.linkedComponents;
    const component_versions: string[] = [];
    for (const config_or_component of args.configs_or_components) {
      let component_version = config_or_component;
      // Load architect.yml if passed
      if (!ComponentVersionSlugUtils.Validator.test(config_or_component) && !ComponentSlugUtils.Validator.test(config_or_component)) {
        const res = buildSpecFromPath(config_or_component);
        linked_components[res.name] = config_or_component;
        component_version = res.name;
      }
      component_versions.push(component_version);
    }

    let account_name;
    if (flags.account) {
      const account = await AccountUtils.getAccount(this.app, flags.account);
      account_name = account.name;
    } else {
      const config_account = this.app.config.defaultAccount();
      if (config_account) {
        account_name = config_account;
      }
    }
    const dependency_manager = new LocalDependencyManager(
      this.app.api,
      account_name,
      linked_components,
    );

    dependency_manager.use_ssl = flags.ssl;
    dependency_manager.external_addr = (flags.ssl ? this.app.config.external_https_address : this.app.config.external_http_address) + `:${flags.port}`;

    if (flags.environment) {
      dependency_manager.environment = flags.environment;
    } else if (flags.production) {
      dependency_manager.environment = 'local-production';
    }

    const component_specs: ComponentSpec[] = [];

    const component_options: ComponentConfigOpts = { interfaces: interfaces_map };

    for (const component_version of component_versions) {
      const component_config = await dependency_manager.loadComponentSpec(component_version, component_options, flags.debug);

      if (flags.recursive) {
        const dependency_configs = await dependency_manager.loadComponentSpecs(component_config.metadata.ref, flags.debug);
        component_specs.push(...dependency_configs);
      } else {
        component_specs.push(component_config);
      }
    }

    const all_secrets = { ...component_parameters, ...component_secrets }; // TODO: 404: remove
    const graph = await dependency_manager.getGraph(component_specs, all_secrets); // TODO: 404: update
    const gateway_admin_port = await PortUtil.getAvailablePort(8080);
    const compose = await DockerComposeUtils.generate(graph, {
      external_addr: flags.ssl ? this.app.config.external_https_address : this.app.config.external_http_address,
      gateway_admin_port,
      ssl_cert: flags.ssl ? this.readSSLCert('fullchain.pem') : undefined,
      ssl_key: flags.ssl ? this.readSSLCert('privkey.pem') : undefined,
    });

    await this.runCompose(compose, environment, flags.port, gateway_admin_port);
  }

  @RequiresDocker({ compose: true })
  async run(): Promise<void> {
    // Oclif only removes the command name if you are running that command
    if (this.argv[0] && this.argv[0].toLocaleLowerCase() === 'deploy') {
      this.argv.splice(0, 1);
    }
    const { args, flags } = await this.parse(Dev);

    if (args.configs_or_components && args.configs_or_components.length > 1 && flags.interface?.length) {
      throw new Error('Interface flag not supported if deploying multiple components in the same command.');
    }

    await this.runLocal();
  }
}
