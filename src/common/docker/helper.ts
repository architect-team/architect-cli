import execa, { ExecaSyncError } from 'execa';
import which from 'which';


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

interface DockerInfoJSON {
  ClientInfo: {
    Debug: boolean,
    Context: string,
    Plugins: [{
      SchemaVersion: string;
      Vendor: string;
      Version: string;
      ShortDescription: string;
      Name: string;
      Path: string;
    }],
    Warnings: null
  };

  ServerErrors?: string[];
}

interface DockerInfo {
  daemon_running: boolean;
  has_buildx: boolean;
  has_compose: boolean;
  plugins: string[];
}
class _DockerHelper {
  docker_installed: boolean;
  docker_info: DockerInfo;

  constructor() {
    this.docker_info = {
      daemon_running: false,
      has_buildx: false,
      has_compose: false,
      plugins: [],
    };

    this.docker_installed = this.checkDockerInstalled();
    if (this.docker_installed) {
      this.docker_info = this.getDockerInfo();
    }
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
    const docker_info = execa.sync('docker', ['info', '--format', '{{json .}}']).stdout;

    const docker_json: DockerInfoJSON = JSON.parse(docker_info);
    const plugins = docker_json.ClientInfo.Plugins.map((plugin) => plugin.Name);

    return {
      daemon_running: !docker_json.ServerErrors,
      has_buildx: plugins.includes('buildx'),
      has_compose: plugins.includes('compose'),
      plugins,
    };
  }

  daemonRunning(): boolean {
    return this.docker_info.daemon_running;
  }

  // TODO: Improve these error messages.
  verifyDocker(): void {
    if (!this.docker_installed) {
       throw new Error('Architect requires Docker to be installed. Please install it and try again.');
    }
  }

  verifyBuildX(): void {
    if (!this.docker_info.has_buildx) {
      throw new Error("docker buildx is not available. Please update your local version of Docker");
    }
  }

  verifyCompose(): void {
    if (!this.docker_info.has_compose) {
      throw new Error("docker compose is not available. Please update your local version of Docker");
    }
  }

  verifyDaemon() {
    if (!this.daemonRunning()) {
      throw new Error('Docker daemon is not running. Please start it and try again.');
    }
  }
}

// Create a singleton DockerHelper
export const DockerHelper = new _DockerHelper();

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