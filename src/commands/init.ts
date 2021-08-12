/* eslint-disable no-empty */
import { flags } from '@oclif/command';
import chalk from 'chalk';
import { classToPlain } from 'class-transformer';
import fs from 'fs';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { AccountUtils } from '../common/utils/account';
import { ComponentSpec } from '../dependency-manager/src/schema/spec/component-spec';
import { VolumeSpec } from '../dependency-manager/src/schema/spec/resource-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../dependency-manager/src/schema/spec/service-spec';

export abstract class InitCommand extends Command {
  auth_required() {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose file';

  static flags = {
    ...Command.flags,
    component_file: flags.string({
      char: 'o',
      description: 'Path where the component file should be written to',
      default: 'architect.yml',
    }),
    account: flags.string({
      char: 'a',
    }),
    name: flags.string({
      char: 'n',
    }),
    from_compose: flags.string({
      default: process.cwd(),
    }),
  };

  async run() {
    const { flags } = this.parse(InitCommand);
    const from_path = path.resolve(untildify(flags.from_compose));
    const docker_compose = DockerComposeUtils.loadDockerCompose(from_path);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
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
    architect_component.name = `${flags.account || account.name}/${flags.name || answers.name}`;
    architect_component.services = {};
    for (const [service_name, service] of Object.entries(docker_compose.services || {})) {
      const architect_service: Partial<ServiceSpec> = {};
      architect_service.description = `${service_name} converted to an Architect service with "architect init"`;
      architect_service.environment = service.environment;
      architect_service.command = service.command;
      architect_service.entrypoint = service.entrypoint;

      if (service.image) {
        architect_service.image = service.image;
      } else if (service.build) {
        architect_service.build = {};
        if (typeof service.build === 'string') {
          architect_service.build.context = service.build;
        } else {
          if (Array.isArray(service.build.args)) {
            architect_service.build.args = {};
            for (const arg of service.build.args) {
              const [key, value] = arg.split('=');
              if (key && value) {
                architect_service.build.args[key] = value;
              } else {
                this.warn(chalk.yellow(`Could not convert environment variable ${arg} for service ${service_name}`));
              }
            }
          } else {
            architect_service.build.args = service.build.args;
          }
          architect_service.build.context = service.build.context;
          if (service.build.dockerfile) {
            architect_service.build.dockerfile = service.build.dockerfile;
          }
        }
      }

      let port_index = 0;
      architect_service.interfaces = {};
      for (const port of service.ports || []) {
        if (typeof port === 'string' || typeof port === 'number') {
          const single_number_port_regex = new RegExp('^\\d+$');
          const single_port_regex = new RegExp('(\\d+[:]\\d+)\\/*([a-zA-Z]+)*$');
          const port_range_regex = new RegExp('(\\d+[-]\\d+)\\/*([a-zA-Z]+)*$');

          if (single_number_port_regex.test(port)) {
            architect_service.interfaces[`interface${port_index}`] = port;
            port_index++;
          } else if (single_port_regex.test(port)) {
            const matches = single_port_regex.exec(port);
            const interface_spec: Partial<ServiceInterfaceSpec> = {};
            if (matches && matches.length >= 3) {
              interface_spec.protocol = matches[2];
            }
            if (matches && matches.length >= 2) {
              interface_spec.port = matches[1].split(':')[1];
            }
            (architect_service.interfaces[`interface${port_index}`] as Partial<ServiceInterfaceSpec>) = interface_spec;
            port_index++;
          } else if (port_range_regex.test(port)) {
            const matches = port_range_regex.exec(port);
            if (matches && matches.length >= 2) {
              const [start, end] = matches[1].split('-');
              for (let i = parseInt(start); i < parseInt(end) + 1; i++) {
                architect_service.interfaces[`interface${port_index}`] = i.toString();
                port_index++;
              }
            }
          } else {
            this.warn(chalk.yellow(`Could not convert port with spec ${port} for service ${service_name}`));
          }
        } else {
          const interface_spec: Partial<ServiceInterfaceSpec> = {};
          interface_spec.port = port.target.toString();
          if (port.protocol) {
            interface_spec.protocol = port.protocol;
          }
          (architect_service.interfaces[`interface${port_index}`] as Partial<ServiceInterfaceSpec>) = interface_spec;
          port_index++;
        }
      }

      const compose_volumes = Object.keys(docker_compose.volumes || {});
      let volume_index = 0;
      const debug_config: Partial<ServiceSpec> = {};
      debug_config.volumes = {};
      architect_service.volumes = {};
      for (const volume of (service.volumes || [])) {
        const volume_key = `volume${volume_index}`;
        if (typeof volume === 'string') {
          const volume_parts = volume.split(':');
          if (volume_parts.length === 1) {
            const service_volume: Partial<VolumeSpec> = {};
            service_volume.mount_path = volume_parts[0];
            architect_service.volumes[volume_key] = service_volume;
          } else if (volume_parts.length === 2 || volume_parts.length === 3) {
            const service_volume: Partial<VolumeSpec> = {};
            if (!compose_volumes.includes(volume_parts[0])) {
              service_volume.host_path = volume_parts[0];
            }
            service_volume.mount_path = volume_parts[1];
            if (volume_parts.length === 3 && volume_parts[2] === 'ro') {
              service_volume.readonly = 'true';
            }
            (debug_config.volumes[volume_key] as Partial<VolumeSpec>) = service_volume;
          } else {
            this.warn(chalk.yellow(`Could not convert volume with spec ${volume} for service ${service_name}`));
          }
        } else {
          if (volume.source) { // debug volume
            const service_volume: Partial<VolumeSpec> = {};
            service_volume.host_path = volume.source;
            service_volume.mount_path = volume.target;
            if (volume.read_only) {
              service_volume.readonly = volume.read_only.toString();
            }

            if (volume.type === 'volume' || compose_volumes.includes(volume.source)) {
              service_volume.host_path = undefined;
              architect_service.volumes[volume_key] = service_volume;
            } else {
              debug_config.volumes[volume_key] = service_volume;
            }
          } else {
            const service_volume: Partial<VolumeSpec> = {};
            service_volume.mount_path = volume.target;
            if (volume.read_only) {
              service_volume.readonly = volume.read_only.toString();
            }
            architect_service.volumes[volume_key] = service_volume;
          }
        }
        volume_index++;
      }
      if (debug_config) {
        architect_service.debug = debug_config;
      }

      if (service.depends_on?.length || service.external_links?.length) {
        const links = new Set((service.depends_on || []).concat(service.external_links || []));
        for (const link of links) {
          architect_service.environment = architect_service.environment || {};
          architect_service.environment[`${link.replace('-', '_').toUpperCase()}_URL`] = `\${{ services.${link}.interfaces.interface0.url }}`;
        }
      }

      architect_component.interfaces = {};
      architect_component.parameters = {};
      architect_component.services[service_name] = architect_service;
    }

    const architect_yml = yaml.dump(yaml.load(JSON.stringify(classToPlain(architect_component))));
    fs.writeFileSync(flags.component_file, architect_yml);
    this.log(chalk.green(`Wrote Architect component config to ${flags.component_file}`));
    this.log(chalk.blue('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.'));
  }
}
