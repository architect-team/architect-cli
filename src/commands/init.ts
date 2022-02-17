/* eslint-disable no-empty */
import { Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import { classToPlain } from 'class-transformer';
import fs from 'fs';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import AccountUtils from '../architect/account/account.utils';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import { BuildSpec, Dictionary, validateOrRejectSpec } from '../dependency-manager/src';
import { VolumeSpec } from '../dependency-manager/src/spec/common-spec';
import { ComponentSpec } from '../dependency-manager/src/spec/component-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../dependency-manager/src/spec/service-spec';

interface ComposeConversion {
  local?: any
  base?: any;
}

export abstract class InitCommand extends Command {
  compose_property_converters: { [key: string]: { architect_property: string, func: (compose_property: any, docker_compose: DockerComposeTemplate, architect_service: Partial<ServiceSpec>) => ComposeConversion } } = {
    environment: { architect_property: 'environment', func: (environment: any) => { return { base: environment }; } },
    command: { architect_property: 'command', func: (command: any) => { return { base: command }; } },
    entrypoint: { architect_property: 'entrypoint', func: (entrypoint: any) => { return { base: entrypoint }; } },
    image: { architect_property: 'image', func: (image: string) => { return { base: image }; } },
    build: { architect_property: 'build', func: this.convertBuild },
    ports: { architect_property: 'interfaces', func: this.convertPorts },
    volumes: { architect_property: 'volumes', func: this.convertVolumes },
    depends_on: { architect_property: 'depends_on', func: this.convertDependsOn },
    external_links: { architect_property: 'depends_on', func: this.convertDependsOn },
  };

  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose file';

  static flags = {
    ...Command.flags,
    component_file: Flags.string({
      description: `${Command.DEPRECATED} Please use --component-file.`,
      hidden: true,
    }),
    'component-file': Flags.string({
      char: 'o',
      description: 'Path where the component file should be written to',
      default: 'architect.yml',
    }),
    account: Flags.string({
      char: 'a',
    }),
    name: Flags.string({
      char: 'n',
    }),
    from_compose: Flags.string({
      description: `${Command.DEPRECATED} Please use --from-compose.`,
      hidden: true,
    }),
    'from-compose': Flags.string({}),
  };

  protected async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['component-file'] = flags.component_file ? flags.component_file : flags['component-file'];
    flags['from-compose'] = flags.from_compose ? flags.from_compose : flags['from-compose'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCommand);

    const from_path = await this.getComposeFromPath(flags);
    const docker_compose = DockerComposeUtils.loadDockerCompose(from_path);

    let account_name = 'my-account';
    try {
      const account = await AccountUtils.getAccount(this.app, flags.account);
      account_name = account.name;
    } catch (err: any) {
      if (err.response?.status === 404) {
        this.error(chalk.red(`Account ${flags.account} not found`));
      }
      this.log(chalk.yellow(`No accounts found, using default account name "${account_name}"`));
    }

    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What should the name of the component be?',
        when: !flags.name,
        filter: value => value.toLowerCase(),
        validate: (value: any) => {
          if ((new RegExp('^[a-z][a-z-]+[a-z]$').test(value))) {
            return true;
          }
          return `Component name can only contain lowercase letters and dashes, and must start and end with a letter.`;
        },
      },
    ]);

    const architect_component: Partial<ComponentSpec> = {};
    architect_component.name = `${flags.name || answers.name}`;
    architect_component.services = {};
    for (const [service_name, service_data] of Object.entries(docker_compose.services || {})) {
      const architect_service: Partial<ServiceSpec> = {};
      for (const [property_name, property_data] of Object.entries(service_data || {})) {
        if (this.compose_property_converters[property_name]) {
          const architect_property_name = this.compose_property_converters[property_name].architect_property;
          const converted_props: ComposeConversion = this.compose_property_converters[property_name].func(property_data, docker_compose, architect_service);
          if (converted_props.local) {
            const local_block_key = "${{ if architect.environment == 'local' }}";
            if (!(architect_service as any)[local_block_key]) {
              (architect_service as any)[local_block_key] = {};
            }
            (architect_service as any)[local_block_key][architect_property_name] = converted_props.local;
          }
          if (converted_props.base) {
            (architect_service as any)[architect_property_name] = converted_props.base;
          }
        } else {
          this.log(chalk.yellow(`Could not convert ${service_name} property ${property_name}`));
        }
      }
      architect_component.services[service_name] = architect_service;
    }

    for (const service_config of Object.values(architect_component.services || {})) {
      for (const depends_on of (service_config.depends_on || [])) {
        service_config.environment = service_config.environment || {};
        if (Object.keys(architect_component.services[depends_on].interfaces || {}).length) {
          service_config.environment[`${depends_on.replace('-', '_').toUpperCase()}_URL`] = `\${{ services.${depends_on}.interfaces.main.url }}`;
        }
      }
    }

    const architect_yml = yaml.dump(yaml.load(JSON.stringify(classToPlain(architect_component))));
    try {
      validateOrRejectSpec(yaml.load(architect_yml));
    } catch (err: any) {
      this.error(chalk.red(`${err}\nYour docker compose file at ${from_path} was unable to be converted to an Architect component. If you think this is a bug, please submit an issue at https://github.com/architect-team/architect-cli/issues.`));
    }

    fs.writeFileSync(flags['component-file'], architect_yml);
    this.log(chalk.green(`Converted ${path.basename(from_path)} and wrote Architect component config to ${flags['component-file']}`));
    this.log(chalk.blue('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.'));
  }

  async getComposeFromPath(flags: any): Promise<string> {
    let from_path;
    if (flags['from-compose']) {
      from_path = path.resolve(untildify(flags['from-compose']));
    } else {
      const files_in_current_dir = fs.readdirSync('.');
      const default_compose = files_in_current_dir.find(f => f.includes('compose') && (f.endsWith('.yml') || f.endsWith('.yaml')));

      if (default_compose) {
        from_path = default_compose;
        if (!fs.existsSync(from_path) || !fs.statSync(from_path).isFile()) {
          throw new Error(`The Docker Compose file ${from_path} couldn't be found.`);
        }
      } else {
        const answers: any = await inquirer.prompt([
          {
            type: 'input',
            name: 'from_compose',
            message: 'What is the filename of the Docker Compose file you would like to convert?',
            validate: (value: any) => {
              return fs.existsSync(value) && fs.statSync(value).isFile() ? true : `The Docker Compose file ${value} couldn't be found.`;
            },
          },
        ]);
        from_path = path.resolve(untildify(answers.from_compose));
      }
    }
    return from_path;
  }

  convertBuild(compose_build: any): ComposeConversion {
    const build: BuildSpec = {};
    if (typeof compose_build === 'string') {
      build.context = compose_build;
    } else {
      if (Array.isArray(compose_build.args)) {
        build.args = {};
        for (const arg of compose_build.args) {
          const [key, value] = arg.split('=');
          if (key && value) {
            build.args[key] = value;
          } else {
            this.warn(chalk.yellow(`Could not convert environment variable ${arg}`));
          }
        }
      } else {
        build.args = compose_build.args;
      }
      build.context = compose_build.context;
      if (compose_build.dockerfile) {
        build.dockerfile = compose_build.dockerfile;
      }
      if (compose_build.target) {
        build.target = compose_build.target;
      }
    }
    return { base: build };
  }

  convertPorts(compose_ports: any[]): ComposeConversion {
    let port_index = 0;
    const interfaces: Dictionary<any> = {};
    for (const port of compose_ports || []) {
      let interface_name = port_index === 0 ? 'main' : `main${port_index + 1}`;

      if (typeof port === 'string' || typeof port === 'number') {
        const string_port = port.toString();
        const single_number_port_regex = new RegExp('^\\d+$');
        const single_port_regex = new RegExp('(\\d+[:]\\d+)\\/*([a-zA-Z]+)*$');
        const port_range_regex = new RegExp('(\\d+[-]\\d+)\\/*([a-zA-Z]+)*$');

        if (single_number_port_regex.test(string_port)) {
          interfaces[interface_name] = typeof port === 'string' ? parseInt(port) : port;
          port_index++;
        } else if (single_port_regex.test(string_port)) {
          const matches = single_port_regex.exec(string_port);
          const interface_spec: Partial<ServiceInterfaceSpec> = {};
          if (matches && matches.length >= 3) {
            interface_spec.protocol = matches[2];
          }
          if (matches && matches.length >= 2) {
            interface_spec.port = parseInt(matches[1].split(':')[1]);
          }
          (interfaces[interface_name] as Partial<ServiceInterfaceSpec>) = interface_spec;
          port_index++;
        } else if (port_range_regex.test(string_port)) {
          const matches = port_range_regex.exec(string_port);
          if (matches && matches.length >= 2) {
            const [start, end] = matches[1].split('-');
            for (let i = parseInt(start); i < parseInt(end) + 1; i++) {
              interface_name = port_index === 0 ? 'main' : `main${port_index + 1}`;
              interfaces[interface_name] = i;
              port_index++;
            }
          }
        } else {
          this.warn(chalk.yellow(`Could not convert port with spec ${port}`));
        }
      } else {
        const interface_spec: Partial<ServiceInterfaceSpec> = {};
        interface_spec.port = typeof port.target === 'string' ? parseInt(port.target) : port.target;
        if (port.protocol) {
          interface_spec.protocol = port.protocol;
        }
        (interfaces[interface_name] as Partial<ServiceInterfaceSpec>) = interface_spec;
        port_index++;
      }
    }
    return { base: interfaces };
  }

  convertVolumes(service_compose_volumes: any[], docker_compose: DockerComposeTemplate): ComposeConversion {
    const compose_volumes = Object.keys(docker_compose.volumes || {});
    let volume_index = 0;
    const local_volumes: Dictionary<any> = {};
    const volumes: Dictionary<any> = {};
    for (const volume of (service_compose_volumes || [])) {
      const volume_key = volume_index === 0 ? 'volume' : `volume${volume_index + 1}`;
      if (typeof volume === 'string') {
        const volume_parts = volume.split(':');
        if (volume_parts.length === 1) {
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.mount_path = volume_parts[0];
          volumes[volume_key] = service_volume;
        } else if (volume_parts.length === 2 || volume_parts.length === 3) {
          const service_volume: Partial<VolumeSpec> = {};
          if (!compose_volumes.includes(volume_parts[0])) {
            service_volume.host_path = volume_parts[0];
          }
          service_volume.mount_path = volume_parts[1];
          if (volume_parts.length === 3 && volume_parts[2] === 'ro') {
            service_volume.readonly = true;
          }
          (local_volumes[volume_key] as Partial<VolumeSpec>) = service_volume;
        } else {
          this.warn(chalk.yellow(`Could not convert volume with spec ${volume}`));
        }
      } else {
        if (volume.source) { // local volume
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.host_path = volume.source;
          service_volume.mount_path = volume.target;
          if (volume.read_only) {
            service_volume.readonly = volume.read_only;
          }

          if (volume.type === 'volume' || compose_volumes.includes(volume.source)) {
            service_volume.host_path = undefined;
            volumes[volume_key] = service_volume;
          } else {
            local_volumes[volume_key] = service_volume;
          }
        } else {
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.mount_path = volume.target;
          if (volume.read_only) {
            service_volume.readonly = volume.read_only;
          }
          volumes[volume_key] = service_volume;
        }
      }
      volume_index++;
    }

    const converted_volumes: ComposeConversion = {};
    if (Object.entries(local_volumes).length) {
      converted_volumes.local = local_volumes;
    }
    if (Object.entries(volumes).length) {
      converted_volumes.base = volumes;
    }
    return converted_volumes;
  }

  convertDependsOn(depends_on_or_links: any, docker_compose: DockerComposeTemplate, architect_service: Partial<ServiceSpec>): ComposeConversion {
    if (!depends_on_or_links.length) {
      return {};
    }

    const depends_on: string[] = [];
    const links: Set<string> = new Set((depends_on_or_links || []).concat(architect_service.depends_on || []));
    for (const link of links) {
      if (!depends_on.includes(link)) {
        depends_on?.push(link);
      }
    }
    return { base: depends_on.length ? depends_on : undefined };
  }
}
