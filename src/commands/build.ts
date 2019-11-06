import {flags} from '@oclif/command';
import execa from 'execa';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs';
import Command from '../base-command';
import ServiceConfig from '../common/service-config';

declare const process: NodeJS.Process;

export default class Build extends Command {
  static description = 'Build an Architect-ready Docker image for a service';

  static flags = {
    ...Command.flags,
    service: flags.string({
      char: 's',
      description: 'Path to a service to build',
      multiple: true,
    }),
    tag: flags.string({
      char: 't',
      description: 'Tag to give to the new Docker image(s)',
      default: 'latest',
    }),
    recursive: flags.boolean({
      default: false,
      char: 'r',
      description: 'Build this image as well as images for all its dependencies',
    }),
  };

  private getServiceApiDefinitionContents(servicePath: string, serviceConfig: ServiceConfig) {
    const definitionsContents: { [filename: string]: string } = {};

    if (
      serviceConfig.api &&
      serviceConfig.api.definitions
    ) {
      for (const filepath of serviceConfig.api.definitions) {
        definitionsContents[filepath] = fs.readFileSync(path.join(servicePath, filepath)).toString('utf-8');
      }
    }

    return definitionsContents;
  }

  async docker(args: string[]) {
    const cmd = execa('docker', args);
    cmd.stdout.pipe(process.stdout);
    await cmd;
  }

  private async buildImage(servicePath: string, prior_paths: string[] = []) {
    const { flags } = this.parse(Build);

    const config = this.getServiceConfig(servicePath);
    const tag = flags.tag || 'latest';
    if (flags.recursive && config.dependencies) {
      for (const serviceRef of Object.values(config.dependencies)) {
        // If the dependency is local, build it first
        if (serviceRef.startsWith('file:')) {
          const dependency_path = path.join(servicePath, serviceRef.slice('file:'.length));

          // If we've already built the image, ignore
          if (!prior_paths.includes(dependency_path)) {
            prior_paths.push(dependency_path);
            await this.buildImage(dependency_path, prior_paths);
          }
        }
      }
    }

    // TODO: Replace with config reference
    const imageTag = `${this.app.config.registry_host}/${config.name}:${tag}`;
    this.log(chalk.blue(`Building docker image for ${config.name}`));
    await this.docker([
      'build',
      '--compress',
      '--build-arg', `SERVICE_LANGUAGE=${config.language}`,
      '-t', imageTag,
      '--label', `architect.json=${JSON.stringify(config)}`,
      '--label', `api_definitions=${JSON.stringify(this.getServiceApiDefinitionContents(servicePath, config))}`,
      servicePath,
    ]);
    this.log(chalk.green(`${config.name}:${tag} build succeeded`));
    return prior_paths;
  }

  async run() {
    const { flags } = this.parse(Build);
    const services = flags.service;

    if (services.length === 0) {
      services.push(process.cwd());
    }

    let service_paths: string[] = [];
    for (let svcPath of services) {
      svcPath = path.resolve(svcPath);
      service_paths.concat(await this.buildImage(svcPath, service_paths));
    }
  }
}
