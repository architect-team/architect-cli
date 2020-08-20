/* eslint-disable no-empty */
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';

export abstract class InitCommand extends Command {
  auth_required() {
    return false;
  }

  static description = 'Initialize an architect component from an existing infrastructure-as-code template';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'from',
    default: path.basename(process.cwd()),
  }];

  async run() {
    const { args } = this.parse(InitCommand);

    const fromPath = path.resolve(untildify(args.from));

    const docker_compose = await InitCommand.rawFromPath(fromPath);

    console.log(docker_compose);
  }

  static getConfigPaths(input: string) {
    return [
      input,
      path.join(input, 'docker-compose.json'),
      path.join(input, 'docker-compose.yml'),
      path.join(input, 'docker-compose.yaml'),
    ];
  }

  static async rawFromPath(path: string): Promise<{}> {
    const [file_path, file_contents] = InitCommand.readFromPath(path);

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
    const try_files = InitCommand.getConfigPaths(input);

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
