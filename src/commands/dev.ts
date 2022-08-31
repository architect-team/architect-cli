import { Flags, Interfaces } from '@oclif/core';
import axios from 'axios';
import chalk from 'chalk';
import { ExecaChildProcess } from 'execa';
import fs, { createWriteStream } from 'fs-extra';
import inquirer from 'inquirer';
import isCi from 'is-ci';
import yaml from 'js-yaml';
import opener from 'opener';
import path from 'path';
import { buildSpecFromPath, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils, Dictionary } from '../';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import { default as BaseCommand, default as Command } from '../base-command';
import LocalDependencyManager, { ComponentConfigOpts } from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import DeployUtils from '../common/utils/deploy.utils';
import { booleanString } from '../common/utils/oclif';
import { RequiresDocker } from '../common/docker/helper';
import PortUtil from '../common/utils/port';

type TraefikHttpService = {
  name: string;
  status: string;
  serverStatus?: Dictionary<string>;
  provider: string;
};

const HOST_REGEX = new RegExp(/Host\(`(.*?)`\)/);

/**
 * Handles the logic for managing the `docker compose up` process.
 *
 * Gracefully stops running containers when the process is interrupted, and
 * stops containers when the underlying process returns with an error.
 */
class UpProcessManager {
  compose_file: string;
  project_name: string;
  detached: boolean;
  is_windows: boolean;

  compose_process?: ExecaChildProcess<string>;
  is_exiting: boolean;
  can_safely_kill: boolean;

  constructor(compose_file: string, project_name: string, detached: boolean) {
    this.compose_file = compose_file;
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
    return DockerComposeUtils.dockerCompose(compose_args,
      { stdout: 'pipe', stdin: 'ignore', detached: !this.is_windows });
  }

  /** Spawns a process running `docker compose stop`  */
  async stop(): Promise<void> {
    await DockerComposeUtils.dockerCompose(['-f', this.compose_file, '-p', this.project_name, 'stop'], { detached: !this.is_windows });
  }

  /** Sends the SIGINT signal to the running `docker compose up` process. */
  interrupt() {
    if (!this.compose_process) {
      throw Error('Must call run() first');
    }
    process.kill(-this.compose_process.pid, 'SIGINT');
  }

  configureInterrupts() {
    process.on('SIGINT', () => {
      this.handleInterrupt();
    });

    // This is what happens with Ctrl+Break on Windows. Treat it like a Ctrl+C, otherwise
    // the user can kill `architect dev` in a "normal" way without the containers stopping.
    process.on('SIGBREAK', () => {
      this.handleInterrupt();
    });
  }

  async handleInterrupt() {
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
  configureLogs() {
    if (!this.compose_process) {
      throw Error('Must call run() first');
    }

    const service_colors = new Map<string, chalk.Chalk>();
    const rand = () => Math.floor(Math.random() * 255);
    this.compose_process.stdout?.on('data', (data) => {
      if (this.is_exiting) {
        return;
      }

      for (const line of data.toString().split('\n')) {
        const lineParts = line.split('|');
        if (lineParts.length > 1) {
          // At this point we can stop the process without leaving containers running.
          this.can_safely_kill = true;
          const service: string = lineParts[0];
          lineParts.shift();
          const newLine = lineParts.join('|');

          if (!service_colors.get(service)) {
            service_colors.set(service, chalk.rgb(rand(), rand(), rand()));
          }

          const color = service_colors.get(service) as chalk.Chalk;
          console.log(color(service + "\t| ") + newLine);
        }
      }
    });
  }

  async run() {
    this.compose_process = this.start();

    this.configureInterrupts();
    this.configureLogs();

    const container_health = DockerComposeUtils.watchContainersHealth(this.compose_file, this.project_name,
      () => { return this.is_exiting; });

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
      exclusive: ['environment', 'auto-approve', 'auto_approve', 'refresh'],
      sensitive: false,
    }),
    parameter: Flags.string({
      char: 'p',
      description: `${Command.DEPRECATED} Please use --secret.`,
      multiple: true,
      hidden: true,
    }),
    interface: Flags.string({
      char: 'i',
      description: 'Component interfaces',
      multiple: true,
      default: [],
      sensitive: false,
    }),
    'secret-file': Flags.string({
      description: 'Path of secrets file',
      multiple: true,
      default: [],
    }),
    secrets: Flags.string({
      description: `${Command.DEPRECATED} Please use --secret-file.`,
      multiple: true,
      hidden: true,
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
      description: `${Command.DEPRECATED} Deploy the stack locally instead of via Architect Cloud`,
      exclusive: ['account', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
      sensitive: false,
      default: false,
    }),
    production: booleanString({
      description: `${Command.DEPRECATED} Please use --environment.`,
      dependsOn: ['local'],
      hidden: true,
      sensitive: false,
      default: undefined,
    }),
    compose_file: Flags.string({
      description: `${Command.DEPRECATED} Please use --compose-file.`,
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
      sensitive: false,
    }),
    values: Flags.string({
      char: 'v',
      hidden: true,
      description: `${Command.DEPRECATED} Please use --secret-file.`,
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
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    if (!options) {
      return super.parse(options, argv);
    }
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    parsed.args.configs_or_components = parsed.argv;

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
      return Object.values(service.serverStatus).some(status => status === 'UP');
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
        this.log(`${chalk.blue(`${protocol}://localhost:${exposed_port}/`)} => ${svc_name}:${internal_port}`);
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

    const config_dir = this.app.config.getConfigDir();
    const project_name = DockerComposeUtils.getProjectName(config_dir, default_project_name);
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(config_dir, project_name);

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
      build_args.push('--build-arg');
      build_args.push(arg);
    }

    await DockerComposeUtils.dockerCompose(['-f', compose_file, '-p', project_name, 'build', ...build_args], { stdio: 'inherit' });
    return [project_name, compose_file];
  }

  async runCompose(compose: DockerComposeTemplate, default_project_name: string, gateway_port: number, gateway_admin_port: number): Promise<void> {
    const { flags } = await this.parse(Dev);
    const [project_name, compose_file] = await this.buildImage(compose, default_project_name);

    console.clear();

    this.log('Building containers...', chalk.green('done'));
    this.log('');

    const traefik_service_map = this.setupTraefikServiceMap(compose, gateway_port, flags.ssl);

    this.log('');
    this.log('Starting containers...');
    this.log('');

    if (!isCi && flags.browser && Object.keys(traefik_service_map).length > 0) {
      this.pollTraefik(gateway_admin_port, traefik_service_map);
    }

    await new UpProcessManager(compose_file, project_name, flags.detached).run();
    fs.removeSync(compose_file);
    process.exit();
  }

  private async getAvailablePort(port: number): Promise<number> {
    while (!(await PortUtil.isPortAvailable(port))) {
      const answers: any = await inquirer.prompt([
        {
          type: 'input',
          name: 'port',
          message: `Trying to listen on port ${port}, but something is already using it. What port would you like us to run the API gateway on (you can use the '--port' flag to skip this message in the future)?`,
          validate: (value: any) => {
            if (new RegExp('^[1-9]+[0-9]*$').test(value)) {
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

  private async downloadFile(url: string, output_location: string): Promise<void> {
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
        const writer = createWriteStream(output_location);
        response.data.pipe(writer);
        response.data.on('end', resolve);
        response.data.on('error', () => {
          return handleReject(resolve, reject);
        });
      }).catch(err => {
        return handleReject(resolve, () => { reject(err); });
      });
    });
  }

  private async downloadSSLCerts() {
    return Promise.all([
      this.downloadFile('https://storage.googleapis.com/architect-ci-ssl/fullchain.pem', path.join(this.app.config.getConfigDir(), 'fullchain.pem')),
      this.downloadFile('https://storage.googleapis.com/architect-ci-ssl/privkey.pem', path.join(this.app.config.getConfigDir(), 'privkey.pem')),
    ]).catch((err) => {
      this.warn(chalk.yellow("We are unable to download the neccessary ssl certificates. Please try again or use --ssl=false to temporarily disable ssl"));
      this.exit(1);
    });
  }

  private async runLocal() {
    const { args, flags } = await this.parse(Dev);

    if (!args.configs_or_components || !args.configs_or_components.length) {
      args.configs_or_components = ['./architect.yml'];
    }

    flags.port = await this.getAvailablePort(flags.port || (flags.ssl ? 443 : 80));

    if (flags.ssl) {
      await this.downloadSSLCerts();
      await DockerComposeUtils.generateTlsConfig(this.app.config.getConfigDir());
    }

    const interfaces_map = DeployUtils.getInterfacesMap(flags.interface);
    const all_secret_file_values = flags['secret-file'].concat(flags.secrets); // TODO: 404: remove
    const component_secrets = DeployUtils.getComponentSecrets(flags.secret, all_secret_file_values);
    const component_parameters = DeployUtils.getComponentSecrets(flags.parameter, all_secret_file_values);

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

    const dependency_manager = new LocalDependencyManager(
      this.app.api,
      linked_components
    );

    dependency_manager.use_ssl = flags.ssl;
    dependency_manager.external_addr = (flags.ssl ? this.app.config.external_https_address : this.app.config.external_http_address) + `:${flags.port}`;

    if (flags.account) {
      const account = await AccountUtils.getAccount(this.app, flags.account);
      dependency_manager.account = account.name;
    } else {
      const config_account = this.app.config.defaultAccount();
      if (config_account) {
        dependency_manager.account = config_account;
      }
    }

    if (flags.environment) {
      dependency_manager.environment = flags.environment;
    } else if (flags.production) {
      dependency_manager.environment = 'local-production';
    }

    const component_specs: ComponentSpec[] = [];

    // Check if multiple instances of the same component are being deployed. This check is needed
    // so that we can disable automatic interface mapping since we can't map a single interface to
    // multiple components at this time
    const onlyUnique = <T>(value: T, index: number, self: T[]) => self.indexOf(value) === index;
    const uniqe_names = component_versions.map(name => name.split('@')[0]).filter(onlyUnique);
    const duplicates = uniqe_names.length !== component_versions.length;

    const component_options: ComponentConfigOpts = { map_all_interfaces: !flags.production && !duplicates, interfaces: interfaces_map };

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
      config_dir: this.app.config.getConfigDir(),
      external_addr: flags.ssl ? this.app.config.external_https_address : this.app.config.external_http_address,
      use_ssl: flags.ssl,
      gateway_admin_port,
    });

    // By default, the project_name used in `docker compose up -p PROJECT_NAME` is the name of the
    // first component in the list of components to run.
    const default_project_name = flags.environment ? flags.environment : component_versions[0];

    await this.runCompose(compose, default_project_name, flags.port, gateway_admin_port);
  }

  @RequiresDocker({ compose: true })
  async run(): Promise<void> {
    // Oclif only removes the command name if you are running that command
    if (this.argv[0] && this.argv[0].toLocaleLowerCase() === "deploy") {
      this.argv.splice(0, 1);
    }
    const { args, flags } = await this.parse(Dev);

    if (args.configs_or_components && args.configs_or_components.length > 1) {
      if (flags.interface?.length) {
        throw new Error('Interface flag not supported if deploying multiple components in the same command.');
      }
    }

    await this.runLocal();
  }
}
