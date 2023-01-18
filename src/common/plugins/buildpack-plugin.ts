import chalk from 'chalk';
import execa from 'execa';
import path from 'path';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import { ArchitectPlugin, PluginArchitecture, PluginBinary, PluginBundleType, PluginOptions, PluginPlatform } from './plugin-types';

export default class BuildpackPlugin implements ArchitectPlugin {
  private plugin_directory = '';
  private binary?: PluginBinary;
  private builder = 'heroku/buildpacks:20';

  version = '0.28.0';
  name: string = BuildpackPlugin.name;
  binaries: PluginBinary[] = [
    {
      platform: PluginPlatform.WINDOWS,
      architecture: PluginArchitecture.AMD64,
      bundle_type: PluginBundleType.ZIP,
      executable_path: 'pack.exe',
      url: 'https://github.com/buildpacks/pack/releases/download/v0.28.0/pack-v0.28.0-windows.zip',
      sha256: '731baec43b5c0d7d94296a969694fab5ef335d9e5c483dabc433631337ae6cff',
    },
    {
      platform: PluginPlatform.LINUX,
      architecture: PluginArchitecture.AMD64,
      bundle_type: PluginBundleType.TAR_GZ,
      executable_path: 'pack',
      url: 'https://github.com/buildpacks/pack/releases/download/v0.28.0/pack-v0.28.0-linux.tgz',
      sha256: '4f51b82dea355cffc62b7588a2dfa461e26621dda3821034830702e5cae6f587',
    },
    {
      platform: PluginPlatform.DARWIN,
      architecture: PluginArchitecture.AMD64,
      bundle_type: PluginBundleType.TAR_GZ,
      executable_path: 'pack',
      url: 'https://github.com/buildpacks/pack/releases/download/v0.28.0/pack-v0.28.0-macos.tgz',
      sha256: 'ec9a355d926cb195abd69040fac556803aa5d4a82e0dde6cc01a5103fc11aa35',
    },
    {
      platform: PluginPlatform.DARWIN,
      architecture: PluginArchitecture.ARM64,
      bundle_type: PluginBundleType.TAR_GZ,
      executable_path: 'pack',
      url: 'https://github.com/buildpacks/pack/releases/download/v0.28.0/pack-v0.28.0-macos-arm64.tgz',
      sha256: '44f22e6da3aa5b2046c58e38b5bc8881e739f92dd80a98f8617f5888f85da424',
    },
  ];

  async setup(pluginDirectory: string, binary: PluginBinary): Promise<void> {
    this.plugin_directory = pluginDirectory;
    this.binary = binary;
  }

  async exec(args: string[], opts: PluginOptions): Promise<execa.ExecaChildProcess<string> | undefined> {
    const cmd = execa(path.join(this.plugin_directory, `/${this.binary?.executable_path}`), args, opts.execa_options);
    if (opts.stdout) {
      cmd.stdout?.pipe(process.stdout);
      cmd.stderr?.pipe(process.stderr);
    }
    return cmd;
  }

  async build(image_name: string, path: string | undefined): Promise<void> {
    if (process.env.TEST === '1') {
      return undefined;
    }

    console.log(chalk.blue(`Begin building buildpack image ${image_name}`));
    let args = ['build', image_name, '--builder', this.builder];
    if (path) {
      args = [...args, '--path', path];
    }

    try {
      await this.exec(args, {
        stdout: true,
        execa_options: {},
      });
    } catch (error) {
      throw new ArchitectError(`Buildpack failed to build ${image_name}. Please use a Dockerfile instead https://docs.architect.io/components/services/#build`);
    }
  }
}
