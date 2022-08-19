import execa, { Options } from 'execa';
import which from 'which';
import { docker } from './cmd';


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

class _DockerHelper {
  docker_exists?: boolean;
  compose_exists?: boolean;
  daemon_running?: boolean;

  checkDockerExists(): boolean {
    if (this.docker_exists === undefined) {
      console.log('calculating docker exists');
      try {
        which.sync('docker');
        this.docker_exists = true;
      } catch {
        this.docker_exists = false;
      }
    }

    return this.docker_exists;
  }

  async checkDaemonRunning(): Promise<boolean> {
    if (this.daemon_running === undefined) {
      console.log('calculating daemon');
      this.daemon_running = false;
      try {
        await docker(['stats', '--no-stream'], { stdout: false });
        this.daemon_running = true;
      } catch {
        this.daemon_running = false;
      }

    }

    return this.daemon_running;
  }

  // TODO: Can probably check compose + buildx via `docker info`
  // Can even check docker by just attemping to run it.
  checkComposeExists(): boolean {
    if (this.compose_exists === undefined) {
      console.log('calculating compose');
      const stdout = execa.sync('docker', ['compose']).stdout;
      if (stdout.includes('docker compose COMMAND --help')) {
        this.compose_exists = true;
      } else {
        this.compose_exists = false;
      }
    }

    return this.compose_exists;
  }

  verifyBuildX(): void {
    console.log('verifying buildx');
    if (!this.checkDockerExists) {
      this.throwMissingDocker();
    }
    // TODO: Check if buildx is available
  }

  verifyCompose(): void {
    console.log('verifying compose');
    if (!this.checkDockerExists()) {
      this.throwMissingDocker();
    }

    if (!this.checkComposeExists()) {
      this.throwMissingCompose();
    }
  }

  /**
   * Checks to make sure docker is installed and that the docker daemon is running. Throws with the corresponding error message if not.
   */
  async verifyDaemon() {
    console.log('verifying daemon');
    if (!this.checkDockerExists()) {
      this.throwMissingDocker();
    }

    if (!await this.checkDaemonRunning()) {
      this.throwNoDockerDaemon();
    }
  }

  throwMissingDocker() {
    throw new Error('Architect requires Docker to be installed. Please install it and try again.');
  }

  throwNoDockerDaemon() {
    throw new Error('Docker daemon is not running. Please start it and try again.');
  }

  throwMissingCompose() {
    throw new Error("Please update your local version of Docker");
  }
}

// Export a singleton DockerHelper.
export const DockerHelper = new _DockerHelper();
