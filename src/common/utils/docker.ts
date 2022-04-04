import execa, { Options } from 'execa';
import which from 'which';

export const docker = async (args: string[], opts = { stdout: true }, execa_opts?: Options): Promise<any> => {
  if (process.env.TEST === '1') {
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
    which.sync('docker');
  } catch {
    throw new Error('Architect requires Docker to be installed. Please install it and try again.');
  }
  try {
    await docker(['stats', '--no-stream'], { stdout: false });
  } catch (err) {
    throw new Error('Docker daemon is not running. Please start it and try again.');
  }
};

export const getDigest = async (image_ref: string): Promise<string> => {
  await docker(['pull', image_ref], { stdout: false });
  const digest = await docker([`inspect`, `--format='{{index .RepoDigests 0}}'`, image_ref], { stdout: false });
  return digest.stdout.split('@')[1].replace('\'', '');
};

export const restart = async (container_id: string): Promise<void> => {
  return docker(['restart', container_id]);
}

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
