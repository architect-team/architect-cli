import { Flags, Interfaces } from '@oclif/core';
import axios, { AxiosResponse } from 'axios';
import chalk from 'chalk';
import fs from 'fs-extra';
import isCi from 'is-ci';
import yaml from 'js-yaml';
import opener from 'opener';
import { buildSpecFromPath, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils } from '../';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import { default as BaseCommand, default as Command } from '../base-command';
import LocalDependencyManager, { ComponentConfigOpts } from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import DeployUtils from '../common/utils/deploy.utils';
import * as Docker from '../common/utils/docker';
import PortUtil from '../common/utils/port';
import { ToSentry } from '../sentry';

@ToSentry(Error,
  (err, ctx) => {
    const error = err as any;
    error.stack = Error(ctx.id).stack;
    return error;
})
export default class Dev extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Run your stack locally';

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    'compose-file': Flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['environment', 'auto-approve', 'auto_approve', 'refresh'],
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
    recursive: Flags.boolean({
      char: 'r',
      default: true,
      allowNo: true,
      description: '[default: true] Toggle to automatically deploy all dependencies',
    }),
    browser: Flags.boolean({
      default: true,
      allowNo: true,
      description: '[default: true] Automatically open urls in the browser for local deployments',
    }),
    port: Flags.integer({
      default: 80,
      description: '[default: 80] Port for the gateway',
    }),
    // Used for proxy from deploy to dev. These will be removed once --local is deprecated
    local: Flags.boolean({
      char: 'l',
      description: `${Command.DEPRECATED} Deploy the stack locally instead of via Architect Cloud`,
      exclusive: ['account', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
    }),
    production: Flags.boolean({
      description: `${Command.DEPRECATED} Please use --environment.`,
      dependsOn: ['local'],
      hidden: true,
    }),
    compose_file: Flags.string({
      description: `${Command.DEPRECATED} Please use --compose-file.`,
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
    }),
    values: Flags.string({
      char: 'v',
      hidden: true,
      description: `${Command.DEPRECATED} Please use --secret-file.`,
    }),
    detached: Flags.boolean({
      description: 'Run in detached mode',
      char: 'd',
    }),
  };

  static args = [{
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  static sensitive = new Set(['secret-file', 'secret', 'secrets', 'values', 'parameter']);

  static non_sensitive = new Set(
    [...Object.keys({ ...Dev.flags }), ...Dev.args.map(arg => arg.name)]
      .filter((value) => !Dev.sensitive.has(value))
  );

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  protected async parse<F, A extends {
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

  setupSigInt(callback: () => void): void {
    if (process.platform === "win32") {
      const rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.on("SIGINT", function () {
        process.emit("SIGINT", "SIGINT");
      });
    }

    process.on("SIGINT", function () {
      callback();
    });
  }

  async runCompose(compose: DockerComposeTemplate): Promise<void> {
    const { flags } = await this.parse(Dev);

    const project_name = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, yaml.dump(compose));
    this.log(`Wrote docker-compose file to: ${compose_file}`);

    await DockerComposeUtils.dockerCompose(['-f', compose_file, '-p', project_name, 'build'], { stdio: 'inherit' });

    console.clear();

    this.log('Building containers...', chalk.green('done'));
    this.log('');

    this.log('Once the containers are running they will be accessible via the following urls:');

    const exposed_interfaces: string[] = [];

    const gateway_port = flags.port;
    for (const [service_name, service] of Object.entries(compose.services)) {
      if (service.labels?.includes('traefik.enable=true')) {
        const host_rules = service.labels.filter(label => label.includes('rule=Host'));
        for (const host_rule of host_rules) {
          const host = new RegExp(/Host\(`(.*?)`\)/g);
          const host_match = host.exec(host_rule);
          if (host_match) {
            this.log(`${chalk.blue(`http://${host_match[1]}:${gateway_port}/`)} => ${service_name}`);
            exposed_interfaces.push(`http://${host_match[1]}:${gateway_port}/`);
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
    this.log('');
    this.log('Starting containers...');
    this.log('');

    if (!isCi && flags.browser) {
      let open_browser_attempts = 0;
      const poll_interval = 2000;
      const browser_interval = setInterval(async () => {
        if (open_browser_attempts === 150) {
          clearInterval(browser_interval);
          return;
        }

        const promises: Promise<AxiosResponse<any>>[] = [];
        for (const exposed_interface of exposed_interfaces) {
          const [host_name, port] = exposed_interface.replace('http://', '').split(':');
          promises.push(axios.get(`http://localhost:${port}`, {
            headers: {
              Host: host_name,
            },
            maxRedirects: 0,
            timeout: poll_interval,
            validateStatus: (status: number) => { return status < 500 && status !== 404; },
          }));
        }

        Promise.all(promises).then(() => {
          for (const exposed_interface of exposed_interfaces) {
            this.log('Opening', chalk.blue(exposed_interface));
            opener(exposed_interface);
          }
          this.log('(disable with --no-browser)');
          clearInterval(browser_interval);
        }).catch(err => {
          // at least one exposed service is not yet ready
        });
        open_browser_attempts++;
      }, poll_interval);
    }

    const compose_args = ['-f', compose_file, '-p', project_name, 'up', '--remove-orphans', '--renew-anon-volumes', '--timeout', '0'];
    if (flags.detached) {
      compose_args.push('-d');
    }

    const docker_compose_runnable = DockerComposeUtils.dockerCompose(compose_args, { stdout: 'pipe', stdin: "ignore" });

    let is_exiting = false;
    this.setupSigInt(() => {
      if (is_exiting) {
        return;
      }
      is_exiting = true;
      docker_compose_runnable.kill('SIGTERM');
    });

    // When docker compose is stopping it will tell the user to hit `ctrl-c` again
    // to cancel. We disabled this functionality so also making the message more clear
    const service_colors = new Map<string, chalk.Chalk>();
    const rand = () => Math.floor(Math.random() * 255);
    docker_compose_runnable.stdout?.on('data', (data) => {
      for (const line of data.toString().split('\n')) {
        if (line.indexOf('Gracefully stopping...') !== -1) {
          console.log("\nGracefully stopping..... Please Wait.....");
          return;
        }
        const lineParts = line.split('|');
        if (lineParts.length > 1) {
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
    DockerComposeUtils.watchContainersHealth(compose_file, project_name, () => { return is_exiting; });

    try {
      await docker_compose_runnable;
    } catch (ex) {
      if (!is_exiting) {
        throw ex;
      }
    }
    fs.removeSync(compose_file);
    process.exit();
  }

  private async runLocal() {
    const { args, flags } = await this.parse(Dev);
    await Docker.verify();

    if (!args.configs_or_components || !args.configs_or_components.length) {
      args.configs_or_components = ['./architect.yml'];
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

    const port_available = await PortUtil.isPortAvailable(flags.port);
    if (!port_available) {
      this.error(`Could not run architect on port ${flags.port}.\nPlease stop an existing process or specify --port to choose a different port.`);
    }
    dependency_manager.external_addr = `arc.localhost:${flags.port}`;

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
      const component_config = await dependency_manager.loadComponentSpec(component_version, component_options);

      if (flags.recursive) {
        const dependency_configs = await dependency_manager.loadComponentSpecs(component_config.metadata.ref);
        component_specs.push(...dependency_configs);
      } else {
        component_specs.push(component_config);
      }
    }

    const all_secrets = { ...component_parameters, ...component_secrets }; // TODO: 404: remove
    const graph = await dependency_manager.getGraph(component_specs, all_secrets); // TODO: 404: update
    const compose = await DockerComposeUtils.generate(graph);
    await this.runCompose(compose);
  }

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
