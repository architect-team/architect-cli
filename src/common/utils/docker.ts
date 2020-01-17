import chalk from 'chalk';
import execa, { Options } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { ServiceConfig, ServiceConfigBuilder } from '../../dependency-manager/src';


export const docker = async (args: string[], opts = { stdout: true }, execa_opts?: Options) => {
  const cmd = execa('docker', args, execa_opts);
  if (opts.stdout) {
    cmd.stdout.pipe(process.stdout);
  }
  try {
    return await cmd;
  } catch (err) {
    if (err.stderr) {
      console.log(chalk.red(err.stderr));
    } else {
      console.log(chalk.red('Architect requires Docker to be installed. Please install it and try again.'));
    }
    process.exit(1);
  }
};

export const getServiceApiDefinitionContents = (service_path: string, service_config: ServiceConfig) => {
  const definitionsContents: { [filename: string]: string } = {};

  const spec = service_config.getApiSpec();
  if (spec.definitions) {
    for (const filepath of spec.definitions) {
      definitionsContents[filepath] = fs.readFileSync(path.join(service_path, filepath)).toString('utf-8');
    }
  }

  return definitionsContents;
};

export const buildImage = async (service_path: string, registry_host: string, tag_name = 'latest') => {
  const config = ServiceConfigBuilder.buildFromPath(service_path);
  const image_tag = `${registry_host}/${config.getName()}:${tag_name}`;
  await docker([
    'build',
    '--compress',
    '--build-arg', `SERVICE_LANGUAGE=${config.getLanguage()}`,
    '-t', image_tag,
    '--label', `architect.json=${JSON.stringify(config)}`,
    '--label', `api_definitions=${JSON.stringify(getServiceApiDefinitionContents(service_path, config))}`,
    service_path,
  ]);
  return image_tag;
};

export const pushImage = async (image_ref: string) => {
  await docker(['push', image_ref]);
};

export const imageExists = async (image_ref: string) => {
  const { stdout } = await docker(['images', '-q', image_ref]);
  return !!stdout;
};

export const parseImageLabel = async (image_ref: string, label_name: string) => {
  const doesImageExist = await imageExists(image_ref);
  if (!doesImageExist) {
    await docker(['pull', image_ref]);
  }

  const { stdout } = await docker(['inspect', image_ref, '--format', `{{ index .Config.Labels "${label_name}"}}`], { stdout: false });
  return JSON.parse(stdout);
};
