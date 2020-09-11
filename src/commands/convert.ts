/* eslint-disable no-empty */
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import DockerComposeTemplate from '../common/docker-compose/template';
import { ComponentConfigBuilder } from '../dependency-manager/src';
import { ComponentConfigV1 } from '../dependency-manager/src/component-config/v1';
import { BuildSpecV1, ServiceConfigV1 } from '../dependency-manager/src/service-config/v1';

export abstract class ConvertCommand extends Command {
  auth_required() {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose template';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'from',
    default: process.cwd(),
    required: false,
  }];

  async run() {
    const { args } = this.parse(ConvertCommand);
    const fromPath = path.resolve(untildify(args.from));
    const docker_compose = ConvertCommand.rawFromPath(fromPath);

    // console.log(docker_compose);

    const converted = new ComponentConfigV1();
    converted.name = `my-account/my-new-component`;
    for (const [service_name, service] of Object.entries(docker_compose.services)) {
      const architect_service = new ServiceConfigV1();
      architect_service.name = service_name;
      architect_service.description = `${service_name} converted to architect service with "architect convert"`;
      architect_service.environment = service.environment;
      architect_service.command = service.command;
      architect_service.entrypoint = service.entrypoint;
      if (service.image) {
        architect_service.image = service.image;
      } else if (service.build) {
        architect_service.build = new BuildSpecV1();
        architect_service.build.args = service.build.args;
        architect_service.build.context = service.build.context;
        if (service.build.dockerfile) {
          architect_service.build.dockerfile = service.build.dockerfile;
        }
      }
      // architect_service.language // TODO: interpret code if dockerfile or code exist?
      let port_index = 0;
      for (const port of service.ports) {
        if (typeof port === 'string') {
          const colon_port_regex = new RegExp('^(\\d+[:]\\d+)'); // 8080:8080
          const host_port_regex = new RegExp('(\\d+[.]\\d+[.]\\d+[.]\\d+)*([a-zA-Z]+)*:(\\d+[:]\\d+)'); // 127.0.0.1:8001:8001, elastic:8001:8001
          const single_number_port = new RegExp('^\\d+$'); // 3000
          const range_as_port = new RegExp('^\\d+-\\d+$'); // 4000-4005


          architect_service.setInterface(`port${port_index}`, );
        }
        port_index++;
      }
      architect_service.setInterface;
      // architect_service.volumes // TODO
    }

    const architect_config = ComponentConfigBuilder.buildFromJSON(converted);
    console.log(architect_config);
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
