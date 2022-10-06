import execa from 'execa';
import semver from 'semver';
import which from 'which';
import { ArchitectError } from '../../dependency-manager/utils/errors';


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

interface DockerInfoPlugin {
  SchemaVersion: string;
  Vendor: string;
  Version: string;
  ShortDescription: string;
  Name: string;
  Path: string;
}

interface DockerInfoJSON {
  ClientInfo: {
    Debug: boolean,
    Context: string,
    Plugins: DockerInfoPlugin[],
    Warnings: null
  };

  ServerErrors?: string[];
}

interface DockerInfo {
  daemon_running: boolean;
  buildx?: DockerInfoPlugin;
  compose?: DockerInfoPlugin;
  plugins: string[];
}

class _DockerHelper {
  docker_installed: boolean;
  docker_info: DockerInfo;

  constructor() {
    this.docker_info = {
      daemon_running: false,
      buildx: undefined,
      compose: undefined,
      plugins: [],
    };

    this.docker_installed = this.checkDockerInstalled();
    if (this.docker_installed) {
      this.docker_info = this.getDockerInfo();
    }
  }

  static getTestHelper(): _DockerHelper {
    const helper = new _DockerHelper();
    helper.docker_installed = true;
    helper.docker_info.daemon_running = true;
    helper.docker_info.buildx = {
      SchemaVersion: '0.1.0',
      Vendor: 'Docker Inc.',
      Version: 'v0.8.1',
      ShortDescription: 'Docker Buildx',
      Name: 'buildx',
      Path: '/usr/local/lib/docker/cli-plugins/docker-buildx',
    };
    helper.docker_info.compose = {
      SchemaVersion: '0.1.0',
      Vendor: 'Docker Inc.',
      Version: 'v2.10.2',
      ShortDescription: 'Docker Compose',
      Name: 'compose',
      Path: '/usr/local/lib/docker/cli-plugins/docker-compose',
    };
    return helper;
  }

  checkDockerInstalled(): boolean {
    try {
      which.sync('docker');
      return true;
    } catch {
      return false;
    }
  }

  getDockerInfo(): DockerInfo {
    let docker_info;
    try {
      docker_info = execa.sync('docker', ['info', '--format', '{{json .}}']).stdout;
    } catch {
      return {
        daemon_running: false,
        buildx: undefined,
        compose: undefined,
        plugins: [],
      };
    }

    const docker_json: DockerInfoJSON = JSON.parse(docker_info);
    const plugins = docker_json.ClientInfo.Plugins.map((plugin) => plugin.Name);
    return {
      daemon_running: !docker_json.ServerErrors,
      buildx: docker_json.ClientInfo.Plugins.find((plugin) => plugin.Name === 'buildx'),
      compose: docker_json.ClientInfo.Plugins.find((plugin) => plugin.Name === 'compose'),
      plugins,
    };
  }

  daemonRunning(): boolean {
    return this.docker_info.daemon_running;
  }

  verifyDocker(): void {
    if (!this.docker_installed) {
      throw new ArchitectError('Architect requires Docker to be installed.\nPlease install docker and try again: https://docs.docker.com/engine/install/');
    }
  }

  verifyBuildX(): void {
    if (!this.docker_info.buildx) {
      throw new ArchitectError("'docker buildx' is not available.\nDocker engine must be updated - visit https://docs.docker.com/engine/install/ or install updates via Docker Desktop.");
    }
  }

  verifyCompose(): void {
    if (!this.docker_info.compose) {
      throw new ArchitectError("'docker compose' is not available.\nDocker engine must be updated - visit https://docs.docker.com/engine/install/ or install updates via Docker Desktop.");
    }
  }

  verifyDaemon() {
    if (!this.daemonRunning()) {
      throw new ArchitectError('Docker daemon is not running. Please start it and try again.');
    }
  }

  composeVersion(version: string) {
    const compose = this.docker_info.compose;
    if (!compose) return false;

    const composeSemver = semver.coerce(compose.Version);
    if (!composeSemver) return false;

    return semver.satisfies(composeSemver.version, version);
  }

  buildXVersion(version: string) {
    const buildx = this.docker_info.buildx;
    if (!buildx) return false;

    const buildXSemver = semver.coerce(buildx.Version);
    if (!buildXSemver) return false;

    return semver.satisfies(buildXSemver.version, version);
  }
}

// Create a singleton DockerHelper
export const DockerHelper = process.env.TEST === '1' ? _DockerHelper.getTestHelper() : new _DockerHelper();

interface RequiresDockerOptions {
  buildx?: boolean,
  compose?: boolean
}

/**
 * Used to wrap `Command.run()` or `Command.runLocal()` methods when specific docker features are required.
 * Should be used as close to the run method as possible so the checks for required docker features happen
 * before any work begins.
 */
export function RequiresDocker(options?: RequiresDockerOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const wrappedFunc = descriptor.value;
    descriptor.value = function (this: any, ...args: any[]) {

      // We always want to verify docker is installed and the daemon is running if any docker usage is required.
      DockerHelper.verifyDocker();
      DockerHelper.verifyDaemon();

      if (options) {
        if (options.compose) {
          DockerHelper.verifyCompose();
        }
        if (options.buildx) {
          DockerHelper.verifyBuildX();
        }
      }

      return wrappedFunc.apply(this, args);
    };
    return descriptor;
  };
}
