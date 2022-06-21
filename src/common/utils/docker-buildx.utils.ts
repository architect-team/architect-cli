import execa, { Options } from 'execa';
import fs from 'fs-extra';
import config from '../../app-config/config';
import { docker } from './docker';

// Adapted from https://github.com/docker-library/official-images#architectures-other-than-amd64
const PLATFORM_MAP = new Map<string, string>([
  ['arm32v6', 'linux/arm/v6'],
  ['arm32v7', 'linux/arm/v7'],
  ['arm64v8', 'linux/arm64'],
  ['amd64', 'linux/amd64'],
  ['windows-amd64', 'windows/amd64'],
]);

export default class DockerBuildXUtils {

  public static isMacM1Machine(): boolean {
    return require('os').cpus()[0].model.includes('Apple M1');
  }

  public static getBuildxPlatform(platform: string): string {
    if (!PLATFORM_MAP.has(platform)) {
      const keys = Array.from(PLATFORM_MAP.keys()).join(', ');
      throw new Error(`Platform '${platform}' is not supported. Supported platforms: ` + keys);
    }
    return PLATFORM_MAP.get(platform) as string;
  }

  public static convertToBuildxPlatforms(platforms: string[]): string[] {
    const buildx_platforms : string[] = [];
    for (const platform_str of platforms) {
      buildx_platforms.push(this.getBuildxPlatform(platform_str));
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
    const builder = is_local ? 'architect-local' : 'architect';

    // Create a docker context
    try {
      await docker(['context', 'create', `${builder}-context`]);
    // eslint-disable-next-line no-empty
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
    // eslint-disable-next-line no-empty
    } catch { }

    return builder;
  }

  public static async dockerBuildX(args: string[], docker_builder_name: string, execa_opts?: Options, use_console = false): Promise<execa.ExecaChildProcess<string>> {
    if (use_console) {
      process.stdin.setRawMode(true);
    }
    const cmd = execa('docker', [`--context=${docker_builder_name}-context`, 'buildx', ...args], execa_opts);
    if (use_console) {
      cmd.on('exit', () => {
        process.exit();
      });
    }
    return cmd;
  }
}
