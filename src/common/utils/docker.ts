import execa, { Options } from 'execa';
import fs from 'fs-extra';
import path from 'path';
import { ServiceConfig } from '../../dependency-manager/src';
import { LocalServiceNode } from '../dependency-manager/local-service-node';


export const docker = async (args: string[], opts = { stdout: true }, execa_opts?: Options): Promise<any> => {
  const cmd = execa('docker', args, execa_opts);
  if (opts.stdout) {
    cmd.stdout?.pipe(process.stdout);
  }
  try {
    return await cmd;
  } catch (err) {
    try {
      await execa('which', ['docker']);
    } catch {
      throw new Error('Architect requires Docker to be installed. Please install it and try again.');
    }
    throw err;
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

export const buildImage = async (node: LocalServiceNode, registry_host: string, tag_name = 'latest') => {
  const config = node.node_config;
  const image_tag = `${registry_host}/${config.getName()}:${tag_name}`;
  await docker([
    'build',
    '--compress',
    '--build-arg', `SERVICE_LANGUAGE=${config.getLanguage()}`,
    '-t', image_tag,
    '--label', `architect.json=${JSON.stringify(config)}`,
    '--label', `api_definitions=${JSON.stringify(getServiceApiDefinitionContents(node.service_path, config))}`,
    node.service_path,
  ]);
  return image_tag;
};

export const pushImage = async (image_ref: string) => {
  await docker(['push', image_ref]);
};

export const getDigest = async (image_ref: string): Promise<string> => {
  await docker(['pull', image_ref], { stdout: false });
  const digest = await docker([`inspect`, `--format='{{index .RepoDigests 0}}'`, image_ref], { stdout: false });
  return digest.stdout.split('@')[1].replace('\'', '');
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

/**
 * this method splits the tag off of an image string. this logic is not straightforward as the image string may contain a port.
 *
 * The key differentiator (and the only way it's logically possible) is that a tag cannot contain a slash. So we look for the last ":" with no trailing "/"
 * @param image
 */
export const strip_tag_from_image: (i: string) => string = (image: string) => {
  if (image.includes('://')) { // remove protocol if exists
    image = image.split('://')[1];
  }

  const split = image.split(':');
  if (split.length === 1) { // no colon indicates a dockerhub native, tagless image (ie postgres)
    return split[0];
  } else if (split.length === 2 && split[1].includes('/')) { // one colon with a slash afterwards indicates a port with no tag (ie privaterepo.com:443/postgres)
    return image;
  } else if (split.length === 2 && !split[1].includes('/')) { // one colon with NO slash afterwards indicates a tag (ie privaterepo.com/postgres:10 or postgres:10)
    return split[0];
  } else if (split.length === 3) { // two colons indicates a port and a tag (ie privaterepo.com:443/postgres:10)
    return `${split[0]}:${split[1]}`;
  } else {
    throw new Error(`Invalid docker image format: ${image}`);
  }
};
