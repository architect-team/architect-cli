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
import DockerComposeTemplate from '../common/docker-compose/template';
import { AccountUtils } from '../common/utils/account';
import { ComponentConfigV1 } from '../dependency-manager/src/component-config/v1';
import { BuildSpecV1, InterfaceSpecV1, ServiceConfigV1, ServiceVolumeV1 } from '../dependency-manager/src/service-config/v1';

export abstract class ConvertCommand extends Command {
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
  };

  static args = [{
    name: 'from',
    default: process.cwd(),
    required: false,
  }];

  async run() {
    const { args, flags } = this.parse(ConvertCommand);
    const fromPath = path.resolve(untildify(args.from));
    const docker_compose = ConvertCommand.rawFromPath(fromPath);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What should the name of the component be?',
        when: !flags.name,
        filter: value => value.toLowerCase(),
      },
    ]);

    const compose_volumes = Object.keys(docker_compose.volumes);

    const architect_component = new ComponentConfigV1();
    architect_component.name = `${flags.account || account.name}/${flags.name || answers.name}`;
    for (const [service_name, service] of Object.entries(docker_compose.services)) {
      const architect_service = new ServiceConfigV1();
      architect_service.name = service_name;
      architect_service.description = `${service_name} converted to an Architect service with "architect convert"`;
      architect_service.environment = service.environment;
      architect_service.command = service.command;
      architect_service.entrypoint = service.entrypoint;

      if (service.image) {
        architect_service.image = service.image;
      } else if (service.build) {
        architect_service.build = new BuildSpecV1();
        architect_service.build.args = {};
        if (service.build.args instanceof Array) {
          const args = {};
          for (const arg in args) {
            const [key, value] = arg.split('=');
            if (key && value) {
              architect_service.build.args[key] = value;
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

      let port_index = 0;
      for (const port of service.ports) {
        if (typeof port === 'string') {
          // TODO: write tests, then condense regexes to use port mapping endings if possible
          const colon_port_regex = new RegExp('^(\\d+[:]\\d+)$'); // 8080:8080
          const host_port_regex = new RegExp('(\\d+[.]\\d+[.]\\d+[.]\\d+)*:(\\d+[:]\\d+)'); // 127.0.0.1:8001:8001
          const single_number_port_regex = new RegExp('^\\d+$'); // 3000
          const range_as_port_regex = new RegExp('^\\d+-\\d+$'); // 4000-4005
          const range_to_port_regex = new RegExp('^\\d+-\\d+:\\d+$'); // 12400-12500:1240
          const range_to_range_regex = new RegExp('^\\d+-\\d+:\\d+-\\d+$'); // 9090-9091:8080-8081
          const host_port_ranges_regex = new RegExp('(\\d+[.]\\d+[.]\\d+[.]\\d+)*([a-zA-Z]+)*:(\\d+-\\d+[:]\\d+-\\d+)'); // 127.0.0.1:5000-5010:5000-5010
          const protocol_port_regex = new RegExp('^(\\d+:\\d+)\\/[a-zA-Z]+$'); // 5000:5000/tcp

          if (colon_port_regex.exec(port)?.length || host_port_regex.exec(port)?.length || range_to_port_regex.exec(port)?.length) {
            const port_number = port.split(':')[1];
            architect_service.setInterface(`interface${port_index}`, port_number);
            port_index++;
          } else if(single_number_port_regex.exec(port)?.length) {
            architect_service.setInterface(`interface${port_index}`, port);
            port_index++;
          } else if(range_as_port_regex.exec(port)?.length) {
            const [start, end] = port.split('-');
            for (let i = parseInt(start); i < parseInt(end); i++) {
              architect_service.setInterface(`interface${port_index}`, i.toString());
              port_index++;
            }
          } else if (range_to_range_regex.exec(port)?.length) {
            const [start, end] = port.split(':')[1].split('-');
            for (let i = parseInt(start); i < parseInt(end); i++) {
              architect_service.setInterface(`interface${port_index}`, i.toString());
              port_index++;
            }
          } else if (host_port_ranges_regex.exec(port)?.length) {
            const [start, end] = port.split(':')[2].split('-');
            for (let i = parseInt(start); i < parseInt(end); i++) {
              architect_service.setInterface(`interface${port_index}`, i.toString());
              port_index++;
            }
          } else if (protocol_port_regex.exec(port)?.length) {
            const port_number = port.split(':')[1].split('/')[0];
            architect_service.setInterface(`interface${port_index}`, port_number);
            port_index++;
          }
        } else {
          const interface_spec = new InterfaceSpecV1();
          interface_spec.port = port.target.toString();
          if (port.protocol) {
            interface_spec.protocol = port.protocol;
          }
          architect_service.setInterface(`interface${port_index}`, interface_spec);
        }
      }

      let volume_index = 0;
      const debug_config = new ServiceConfigV1();
      for (const volume of (service.volumes || [])) {
        const volume_key = `volume${volume_index}`;
        if (typeof volume === 'string') {
          architect_service.setVolume(volume_key, volume);
        } else {
          if (volume.source) { // debug volume
            const service_volume = new ServiceVolumeV1();
            service_volume.host_path = volume.source;
            service_volume.mount_path = volume.target;
            service_volume.readonly = volume.read_only;

            if (volume.type === 'volume' || compose_volumes.includes(volume.source)) {
              service_volume.host_path = undefined;
              architect_service.setVolume(volume_key, service_volume);
            } else {
              debug_config.setVolume(volume_key, service_volume);
            }
          } else {
            const service_volume = new ServiceVolumeV1();
            service_volume.mount_path = volume.target;
            service_volume.readonly = volume.read_only;
            architect_service.setVolume(volume_key, service_volume);
          }
        }
        volume_index++;
      }
      architect_service.setDebugOptions(debug_config);

      if (service.depends_on?.length) {
        for (const depends_on_service of service.depends_on) {
          architect_service.setEnvironmentVariable(`${depends_on_service.toUpperCase()}_URL`, `\${{ services.${depends_on_service}.interfaces.interface0.url }}`);
        }
      }

      architect_component.setService(service_name, architect_service);
    }

    const architect_yml = yaml.safeDump(yaml.safeLoad(JSON.stringify(classToPlain(architect_component))));
    fs.writeFileSync(flags.component_file, architect_yml);
    this.log(chalk.green(`Wrote Architect component config to ${flags.component_file}`));
    this.log(chalk.blue('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.'));
  }

  static getConfigPaths(input: string) {
    return [
      input,
      path.join(input, 'docker-compose.json'),
      path.join(input, 'docker-compose.yml'),
      path.join(input, 'docker-compose.yaml'),
    ];
  }

  static rawFromPath(compose_file: string): DockerComposeTemplate {
    const [file_path, file_contents] = ConvertCommand.readFromPath(compose_file);

    let raw_config;
    try {
      raw_config = JSON.parse(file_contents);
    } catch {
      try {
        raw_config = yaml.safeLoad(file_contents);
      } catch { }
    }

    if (!raw_config) {
      throw new Error('Invalid docker-compose format. Must be json or yaml.');
    }

    return raw_config;
  }

  static readFromPath(input: string): [string, string] {
    const try_files = ConvertCommand.getConfigPaths(input);

    // Make sure the file exists
    let file_path;
    let file_contents;
    for (const file of try_files) {
      try {
        const data = fs.lstatSync(file);
        if (data.isFile()) {
          file_contents = fs.readFileSync(file, 'utf-8');
          file_path = file;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!file_contents || !file_path) {
      throw new Error(`No docker-compose file found at ${input}`);
    }

    return [file_path, file_contents];
  }
}
