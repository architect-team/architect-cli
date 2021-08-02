import execa, { Options } from 'execa';

const CACHE_TAG = 'architect-cache';

export const docker = async (args: string[], opts = { stdout: true }, execa_opts?: Options): Promise<any> => {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  const cmd = execa('docker', args, execa_opts);
  if (opts.stdout) {
    cmd.stdout?.pipe(process.stdout);
    cmd.stderr?.pipe(process.stderr);
  }
  return await cmd;
};

/**
 * Checks to make sure docker is installed and that the docker daemon is running. Throws with the corresponding error message if not.
 */
export const verify = async (): Promise<void> => {
  try {
    await execa('which', ['docker']);
  } catch {
    throw new Error('Architect requires Docker to be installed. Please install it and try again.');
  }
  try {
    await docker(['stats', '--no-stream'], { stdout: false });
  } catch (err) {
    throw new Error('Docker daemon is not running. Please start it and try again.');
  }
};

export const toCacheTag = (image_ref: string) => {
  return image_ref.replace( /:[a-zA-Z0-9]+$/g, `:${CACHE_TAG}`);
};

export const buildImage = async (build_path: string, image_tag: string, dockerfile?: string, build_args: string[] = []) => {
  const dockerfile_args = dockerfile ? ['-f', dockerfile] : [];
  for (const build_arg of build_args) {
    dockerfile_args.push('--build-arg');
    dockerfile_args.push(build_arg);
  }

  if (!image_tag.endsWith(':architect-cache')) {
    dockerfile_args.push('--cache-from');
    dockerfile_args.push(toCacheTag(image_tag));
  }

  await docker([
    'build',
    '--compress',
    '-t', image_tag,
    ...dockerfile_args,
    build_path,
  ]);
  return image_tag;
};

export const pushImage = async (image_ref: string) => {
  await docker(['push', image_ref]);
};

export const pullImage = async (image_ref: string) => {
  await docker(['pull', '-q', image_ref], { stdout: false });
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
export const stripTagFromImage: (i: string) => string = (image: string) => {
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
