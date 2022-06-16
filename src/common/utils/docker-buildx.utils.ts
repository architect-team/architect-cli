import execa, { Options } from 'execa';
import fs from 'fs-extra';
import config from '../../app-config/config';
import { docker } from './docker';

const OPERATING_SYSTEMS = ['aix', 'android', 'darwin', 'dragonfly', 'freebsd', 'hurd', 'illumos', 'js', 'linux', 'nacl', 'netbsd', 'openbsd', 'plan9', 'solaris', 'windows', 'zos'];
const ARCHITECTURES = ['386', 'amd64', 'amd64p32', 'arm', 'armbe', 'arm64', 'arm64be', 'ppc64', 'ppc64le', 'mips', 'mipsle', 'mips64', 'mips64le', 'mips64p32', 'mips64p32le', 'ppc', 'riscv', 'riscv64', 's390', 's390x', 'sparc', 'sparc64', 'wasm'];

interface Platform {
  os: string,
  arch: string,
  variant: string,
}

export default class DockerBuildXUtils {

  public static isMacM1Machine(): boolean {
    return require('os').cpus()[0].model.includes('Apple M1');
  }

  public static normalizeOS(os: string): string {
    os = os.toLowerCase();
    return os === 'macos' ? 'darwin' : os;
  }

  public static normalizePlatform(platform: Platform): Platform {
    let arch = platform.arch.toLowerCase();
    let variant = platform.variant.toLowerCase();
    switch (arch) {
      case 'i386':
        arch = '386';
        variant = '';
        break;
      case 'x86_64':
      case 'x86-64':
        arch = 'amd64';
        variant = '';
        break;
      case 'aarch64':
      case 'arm64':
        arch = 'arm64';
        switch (variant) {
          case '8':
          case 'v8':
            variant = '';
        }
        break;
      case 'armhf':
        arch = 'arm';
        variant = 'v7';
        break;
      case 'armel':
        arch = 'arm';
        variant = 'v6';
        break;
      case 'arm':
        switch (variant) {
          case '':
          case '7':
            variant = 'v7';
            break;
          case '5':
          case '6':
          case '8':
            variant = 'v' + variant;
        }
    }

    platform.arch = arch;
    platform.variant = variant;
    platform.os = this.normalizeOS(platform.os);
    return platform;
  }

  public static convertToPlatform(platform: string): Platform {
    const err_msg = 'Failed to register with platform flag. Must use format {OS}/{architecture}/{?version}. Ex: linux/amd64 or linux/arm/v7';
    
    const parsed = platform.split('/');
    if (parsed.length < 2 || parsed.length > 3) {
      throw new Error(err_msg);
    }

    const pf: Platform = {
      os: parsed[0],
      arch: parsed[1],
      variant: parsed.length === 3 ? parsed[2] : '',
    };
    return pf;
  }

  public static convertPlatformToString(platform: Platform): string {
    const platform_str = platform.os + '/' + platform.arch;
    return platform.variant ? platform_str + '/' + platform.variant : platform_str;
  }

  public static normalizePlatforms(platform_flag: string): string[] {
    const platforms: string[] = platform_flag.split(',');
    const normed_platforms : string[] = [];
    for (const platform_str of platforms) {
      let platform = this.convertToPlatform(platform_str);
      platform = this.normalizePlatform(platform);

      if (!ARCHITECTURES.includes(platform.arch)) {
        throw new Error('Your platform architecture is not supported.\nSupported architectures: ' + ARCHITECTURES.join(', '));
      }
      if (!OPERATING_SYSTEMS.includes(platform.os)) {
        throw new Error('Your platform operating system is not supported.\nSupported operating systems: ' + OPERATING_SYSTEMS.join(', '));
      }

      normed_platforms.push(this.convertPlatformToString(platform));
    }
    return normed_platforms;
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
