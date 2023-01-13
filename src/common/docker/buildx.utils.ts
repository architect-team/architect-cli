import execa, { Options } from 'execa';
import fs from 'fs-extra';
import os from 'os';
import config from '../../app-config/config';
import AppService from '../../app-config/service';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import { docker } from './cmd';
import { RequiresDocker } from './helper';

// Adapted from https://github.com/docker-library/official-images#architectures-other-than-amd64
const PLATFORM_MAP = new Map<string, string>([
  ['arm32v6', 'linux/arm/v6'],
  ['arm32v7', 'linux/arm/v7'],
  ['arm64v8', 'linux/arm64'],
  ['amd64', 'linux/amd64'],
  ['windows-amd64', 'windows/amd64'],
]);

interface BuildxParams {
  app: AppService;
  compose_file: string;
  build_args: string[];
}

export interface DockerImage {
  name: string;
  ref: string;
}

export default class DockerBuildXUtils {
  public static isMacM1Machine(): boolean {
    return os.cpus()[0].model.includes('Apple M1');
  }

  public static getBuildxPlatform(architecture: string): string {
    if (!PLATFORM_MAP.has(architecture)) {
      const keys = [...PLATFORM_MAP.keys()].join(', ');
      throw new Error(`Architecture '${architecture}' is not supported. Supported architectures: ` + keys);
    }
    return PLATFORM_MAP.get(architecture) as string;
  }

  public static convertToBuildxPlatforms(architectures: string[]): string[] {
    const buildx_platforms: string[] = [];
    for (const architecture of architectures) {
      buildx_platforms.push(this.getBuildxPlatform(architecture));
    }
    return buildx_platforms;
  }

  public static async writeBuildkitdConfigFile(file_name: string, file_content: string): Promise<void> {
    await fs.writeFile(file_name, file_content, (err) => {
      if (err) {
        throw new Error('Failed to create Buildkit configuration file!');
      }
    });
  }

  public static isLocal(config: config): boolean {
    return config.api_host.includes('localhost') || config.api_host.includes('0.0.0.0') || config.api_host.includes('127.0.0.1');
  }

  public static async getBuilder(config: config): Promise<string> {
    const is_local = this.isLocal(config);
    const builder = (is_local ? 'architect-local' : 'architect') + `-${process.platform}`;

    // Create a docker context
    try {
      await docker(['context', 'create', `${builder}-context`]);
    } catch (err) { }

    try {
      if (is_local) {
        // Create a configuration file for buildkitd
        const local_buildkitd_config_file = config.getConfigDir() + '/buildkitd.toml';
        const file_content = `[registry.'${config.registry_host}']\n  http = true\n  insecure = true`;
        await this.writeBuildkitdConfigFile(local_buildkitd_config_file, file_content);

        await this.dockerBuildX(['create', '--name', builder, '--driver', 'docker-container', '--driver-opt', 'image=moby/buildkit:master,network=host', '--use', '--buildkitd-flags', '--allow-insecure-entitlement security.insecure', `--config=${local_buildkitd_config_file}`], builder, {
          stdio: 'inherit',
        });
      } else {
        await this.dockerBuildX(['create', '--name', builder], builder, {
          stdio: 'inherit',
        });
      }
    } catch { }

    return builder;
  }

  @RequiresDocker({ buildx: true })
  public static async dockerBuildX(args: string[], docker_builder_name: string, execa_opts?: Options, use_console = false): Promise<execa.ExecaChildProcess<string>> {
    if (use_console && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    const cmd = execa('docker', [`--context=${docker_builder_name}-context`, 'buildx', '--builder', docker_builder_name, ...args], execa_opts);
    if (use_console) {
      cmd.on('exit', () => {
        // eslint-disable-next-line no-process-exit
        process.exit();
      });
    }
    return cmd;
  }

  @RequiresDocker({ buildx: true })
  public static async buildAndPush(buildx_params: BuildxParams): Promise<void> {
    const { app, compose_file, build_args } = buildx_params;

    const builder = await this.getBuilder(app.config);
    try {
      await this.dockerBuildX(['bake', '-f', compose_file, '--push', ...build_args], builder, {
        stdio: 'inherit',
      });
    } catch (err: any) {
      fs.removeSync(compose_file);
      throw new ArchitectError(err.message);
    }
  }

  @RequiresDocker()
  public static async pushImagesToRegistry(images: DockerImage[]): Promise<void> {
    for (const image of images) {
      await docker(['tag', `${image.name}:latest`, image.ref]);
      await docker(['push', image.ref]);
    }
  }

  @RequiresDocker()
  public static async build(images: DockerImage[], use_buildx: boolean, buildx_params: BuildxParams): Promise<void> {
    this.pushImagesToRegistry(images);

    if (use_buildx) {
      await this.buildAndPush(buildx_params);
    }
  }
}
