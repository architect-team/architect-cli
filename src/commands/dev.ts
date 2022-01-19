import { flags } from '@oclif/command';
import axios, { AxiosResponse } from 'axios';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import isCi from 'is-ci';
import yaml from 'js-yaml';
import opener from 'opener';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import DeployUtils from '../common/utils/deploy.utils';
import * as Docker from '../common/utils/docker';
import { ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils } from '../dependency-manager/src';
import { buildSpecFromPath } from '../dependency-manager/src/spec/utils/component-builder';

export abstract class DevCommand extends Command {

  static flags = {
    ...Command.flags,
  };

  parse(options: any, argv = this.argv): any {
    const parsed = super.parse(options, argv);
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    parsed.flags = flags;

    return parsed;
  }
}

export default class Dev extends DevCommand {
  auth_required(): boolean {
    return false;
  }

  static description = 'Run your stack locally';

  static flags = {
    ...DevCommand.flags,
    ...EnvironmentUtils.flags,

    'compose-file': flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['environment', 'auto-approve', 'auto_approve', 'refresh'],
    }),
    parameter: flags.string({
      char: 'p',
      description: 'Component parameters',
      multiple: true,
      default: [],
    }),
    interface: flags.string({
      char: 'i',
      description: 'Component interfaces',
      multiple: true,
      default: [],
    }),
    secrets: flags.string({
      char: 's',
      description: 'Path of secrets file',
    }),
    recursive: flags.boolean({
      char: 'r',
      default: true,
      allowNo: true,
      description: '[default: true] Toggle to automatically deploy all dependencies',
    }),
    browser: flags.boolean({
      default: true,
      allowNo: true,
      description: '[default: true] Automatically open urls in the browser for local deployments',
    }),
    'build-parallel': flags.boolean({
      default: false,
      description: '[default: false] Build docker images in parallel',
    }),
  };

  static args = [{
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  parse(options: any, argv = this.argv): any {
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = super.parse(options, argv);
    parsed.args.configs_or_components = parsed.argv;

    parsed.flags = DeployUtils.parseFlags(parsed.flags);

    return parsed;
  }

  async runCompose(compose: DockerComposeTemplate): Promise<void> {
    const { flags } = this.parse(Dev);

    const project_name = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, yaml.dump(compose));
    this.log(`Wrote docker-compose file to: ${compose_file}`);

    if (flags['build-parallel']) {
      await execa('docker-compose', ['-f', compose_file, '-p', project_name, 'build', '--parallel'], { stdio: 'inherit' });
    } else {
      await execa('docker-compose', ['-f', compose_file, '-p', project_name, 'build'], { stdio: 'inherit' });
    }

    console.clear();

    this.log('Building containers...', chalk.green('done'));
    this.log('');

    this.log('Once the containers are running they will be accessible via the following urls:');

    const exposed_interfaces: string[] = [];
    const gateway = compose.services['gateway'];
    if (gateway?.ports?.length && typeof gateway.ports[0] === 'string') {
      const gateway_port = gateway.ports[0].split(':')[0];
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
    }

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

    const compose_args = ['-f', compose_file, '-p', project_name, 'up', '--timeout', '0'];
    if (flags.detached) {
      compose_args.push('-d');
    }

    const cmd = execa('docker-compose', compose_args);
    cmd.stdin?.pipe(process.stdin);
    cmd.stdout?.pipe(process.stdout);
    cmd.stderr?.pipe(process.stderr);

    process.on('SIGINT', () => {
      this.log('Interrupt received.');
      this.warn('Please wait for architect to exit or containers will still be running in the background.');
      this.log('Gracefully shutting down...');
      execa.sync('docker-compose', ['-f', compose_file, '-p', project_name, 'stop', '--timeout', '0'], { stdio: 'inherit' });
      this.log('Stopping operation...');
      process.exit(0);
    });

    await cmd;
  }

  private async runLocal() {
    const { args, flags } = this.parse(Dev);
    await Docker.verify();

    if (!args.configs_or_components || !args.configs_or_components.length) {
      args.configs_or_components = ['./architect.yml'];
    }

    const interfaces_map = DeployUtils.getInterfacesMap(flags.interface);
    const component_secrets = DeployUtils.getComponentSecrets(flags.secrets, flags.parameter);

    const linked_components = this.app.linkedComponents;
    const component_versions: string[] = [];
    for (const config_or_component of args.configs_or_components) {

      let component_version = config_or_component;
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

    const component_options = { map_all_interfaces: !flags.production && !duplicates };

    for (const component_version of component_versions) {
      const component_config = await dependency_manager.loadComponentSpec(component_version, interfaces_map, component_options);

      if (flags.recursive) {
        const dependency_configs = await dependency_manager.loadComponentSpecs(component_config);
        component_specs.push(...dependency_configs);
      } else {
        component_specs.push(component_config);
      }
    }
    const graph = await dependency_manager.getGraph(component_specs, component_secrets);
    const compose = await DockerComposeUtils.generate(graph);
    await this.runCompose(compose);
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(Dev);

    if (args.configs_or_components && args.configs_or_components.length > 1) {
      if (flags.interface?.length) {
        throw new Error('Interface flag not supported if deploying multiple components in the same command.');
      }
    }

    this.log(flags);
    this.log(args);

    await this.runLocal();
  }
}
