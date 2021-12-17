/* eslint-disable no-empty */
import { flags } from '@oclif/command';
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
import { BuildSpec, Dictionary, ServiceConfig, validateOrRejectSpec } from '../dependency-manager/src';
import { VolumeSpec } from '../dependency-manager/src/spec/common-spec';
import { ComponentSpec } from '../dependency-manager/src/spec/component-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../dependency-manager/src/spec/service-spec';

export abstract class InitCommand extends Command {
  local_config_placeholder = '<LOCAL_CONFIG_PLACEHOLDER>'; // TODO: update? currently passes validation, but change to something less general?

  auth_required(): boolean {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose file';

  static flags = {
    ...Command.flags,
    component_file: flags.string({
      description: `${Command.DEPRECATED} Please use --component-file.`,
      hidden: true,
    }),
    'component-file': flags.string({
      char: 'o',
      description: 'Path where the component file should be written to',
      default: 'architect.yml',
    }),
    account: flags.string({ // TODO: should this be required? why can't we use this offline or without an account?
      char: 'a',
    }),
    name: flags.string({
      char: 'n',
    }),
    from_compose: flags.string({
      description: `${Command.DEPRECATED} Please use --from-compose.`,
      hidden: true,
    }),
    'from-compose': flags.string({
      // default: process.cwd(),
    }),
  };

  parse(options: any, argv = this.argv): any {
    const parsed = super.parse(options, argv);
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['component-file'] = flags.component_file ? flags.component_file : flags['component-file'];
    flags['from-compose'] = flags.from_compose ? flags.from_compose : flags['from-compose'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { flags } = this.parse(InitCommand);

    let from_path;
    if (flags['from-compose']) {
      from_path = path.resolve(untildify(flags['from-compose']));
    } else {
      const files_in_current_dir = fs.readdirSync('.');
      const default_compose = files_in_current_dir.find(f => f === 'docker-compose.yml' || f === 'docker-compose.yaml' || (f.includes('compose') && (f.endsWith('.yml') || f.endsWith('.yaml'))));

      if (default_compose) {
        from_path = default_compose;
      } else {
        const answers: any = await inquirer.prompt([
          {
            type: 'input',
            name: 'from_compose',
            message: 'What is the filename of the Docker Compose file you would like to convert?',
            default: default_compose,
            validate: (value: any) => {
              return fs.existsSync(value) && fs.statSync(value).isFile() ? true : `The Docker Compose file ${value} couldn't be found.`;
            },
          },
        ]);
        from_path = path.resolve(untildify(answers.from_compose));
      }
    }
    const docker_compose = DockerComposeUtils.loadDockerCompose(from_path);

    const account = await AccountUtils.getAccount(this.app, flags.account);
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

    const compose_property_converters: { [key: string]: { architect_property: string, func: Function } } = { // TODO: make tuples for compose-architect properties that aren't 1:1?
      environment: { architect_property: 'environment', func: function convertEnvironment(environment: any) { return { standard: environment }; } },
      command: { architect_property: 'command', func: function convertCommand(command: any) { return { standard: command }; } },
      entrypoint: { architect_property: 'entrypoint', func: function convertEntrypoint(entrypoint: any) { return { standard: entrypoint }; } },
      image: { architect_property: 'image', func: function convertImage(image: string) { return { standard: image }; } },
      build: { architect_property: 'build', func: this.convertBuild },
      ports: { architect_property: 'interfaces', func: this.convertPorts },
      volumes: { architect_property: 'volumes', func: this.convertVolumes },
      depends_on: { architect_property: 'depends_on', func: this.convertDependsOn }, // TODO: shouldn't run this twice
      external_links: { architect_property: 'depends_on', func: this.convertDependsOn },
    }

    const architect_component: Partial<ComponentSpec> = {};
    architect_component.name = `${flags.account || account.name}/${flags.name || answers.name}`;
    architect_component.services = {};
    for (const [service_name, service_data] of Object.entries(docker_compose.services || {})) {
      const architect_service: Partial<ServiceSpec> = {};
      for (const [property_name, property_data] of Object.entries(service_data || {})) {
        // console.log(property_name) // TODO: remove
        if (compose_property_converters[property_name]) {
          const architect_property_name = compose_property_converters[property_name].architect_property;
          const converted_props: { debug?: any, standard?: any } = compose_property_converters[property_name].func(property_data, docker_compose, architect_service);
          if (converted_props.debug) {
            if (!(architect_service as any)[this.local_config_placeholder]) { // TODO: any
              (architect_service as any)[this.local_config_placeholder] = {};
            }
            (architect_service as any)[this.local_config_placeholder][architect_property_name] = converted_props.debug;
          }
          if (converted_props.standard) {
            (architect_service as any)[architect_property_name] = converted_props.standard;
          }
        }
      }
      architect_component.services[service_name] = architect_service;
    }

    for (const [service_name, service_config] of Object.entries(architect_component.services || {})) {
      for (const link of (service_config.depends_on || [])) {
        service_config.environment = service_config.environment || {};
        if (Object.keys(architect_component.services[link].interfaces || {}).length) {
          service_config.environment[`${link.replace('-', '_').toUpperCase()}_URL`] = `\${{ services.${link}.interfaces.main.url }}`; // TODO: remove in favor of depends_on?
        }
      }
    }

    let architect_yml = yaml.dump(yaml.load(JSON.stringify(classToPlain(architect_component))));
    const debug_regex = new RegExp(`${this.local_config_placeholder}:`, 'gm');
    architect_yml = architect_yml.replace(debug_regex, "${{ if architect.environment == 'local' }}:");
    validateOrRejectSpec(yaml.load(architect_yml));

    fs.writeFileSync(flags['component-file'], architect_yml);
    this.log(chalk.green(`Converted ${path.basename(from_path)} and wrote Architect component config to ${flags['component-file']}`));
    this.log(chalk.blue('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.'));
  }

  convertBuild(compose_build: any) {
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
            // this.warn(chalk.yellow(`Could not convert environment variable ${arg} for service ${service_name}`)); // TODO
          }
        }
      } else {
        build.args = compose_build.args;
      }
      build.context = compose_build.context;
      if (compose_build.dockerfile) {
        build.dockerfile = compose_build.dockerfile;
      }
    }
    return { standard: build };
  }

  convertPorts(compose_ports: any[]) {
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
          console.log('RANGE ' + string_port)
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
          // this.warn(chalk.yellow(`Could not convert port with spec ${port} for service ${service_name}`)); // TODO
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
    return { standard: interfaces };
  }

  convertVolumes(service_compose_volumes: any[], docker_compose: DockerComposeTemplate) {
    const compose_volumes = Object.keys(docker_compose.volumes || {});
    let volume_index = 0;
    const debug_volumes: Dictionary<any> = {};
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
          (debug_volumes[volume_key] as Partial<VolumeSpec>) = service_volume;
        } else {
          // this.warn(chalk.yellow(`Could not convert volume with spec ${volume} for service ${service_name}`)); // TODO
        }
      } else {
        if (volume.source) { // debug volume
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
            debug_volumes[volume_key] = service_volume;
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

    const valid_volumes: { debug?: any, standard?: any } = {};
    if (Object.entries(debug_volumes).length) {
      valid_volumes.debug = debug_volumes;
    }
    if (Object.entries(volumes).length) {
      valid_volumes.standard = volumes;
    }
    return valid_volumes;
  }

  convertDependsOn(depends_on_or_links: any, docker_compose: DockerComposeTemplate, architect_service: Partial<ServiceConfig>) {
    if (!depends_on_or_links.length) {
      return undefined;
    }

    const depends_on: string[] = [];
    const links: Set<string> = new Set((depends_on_or_links || []).concat(architect_service.depends_on || []));
    for (const link of links) {
      if (!depends_on.includes(link)) {
        depends_on?.push(link);
      }
    }
    return { standard: depends_on.length ? depends_on : undefined };
  }
}
