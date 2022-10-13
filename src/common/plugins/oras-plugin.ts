import execa from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ArchitectPlugin, PluginArchitecture, PluginBinary, PluginBundleType, PluginOptions, PluginPlatform } from './plugin-manager';
import PluginUtils from './plugin-utils';

export default class OrasPlugin implements ArchitectPlugin {
  private plugin_directory = '';
  private binary?: PluginBinary;

  version = '0.15.0';
  name: string = OrasPlugin.name;
  binaries: PluginBinary[] = [
    {
      platform: PluginPlatform.WINDOWS,
      architecture: PluginArchitecture.AMD64,
      bundle_type: PluginBundleType.ZIP,
      executable_path: 'oras.exe',
      url: 'https://github.com/oras-project/oras/releases/download/v0.15.0/oras_0.15.0_windows_amd64.zip',
      sha256: 'f8a43b8f3b1caf0a3c3a2204a7eab597d3a9241b1e0673c4d8a23ad439cd652a',
    },
    {
      platform: PluginPlatform.LINUX,
      architecture: PluginArchitecture.AMD64,
      bundle_type: PluginBundleType.TAR_GZ,
      executable_path: 'oras',
      url: 'https://github.com/oras-project/oras/releases/download/v0.15.0/oras_0.15.0_linux_amd64.tar.gz',
      sha256: '529c9d567f212093bc01c508b71b922fc6c6cbc74767d3b2eb7f9f79d534e718',
    },
    {
      platform: PluginPlatform.DARWIN,
      architecture: PluginArchitecture.AMD64,
      bundle_type: PluginBundleType.TAR_GZ,
      executable_path: 'oras',
      url: 'https://github.com/oras-project/oras/releases/download/v0.15.0/oras_0.15.0_darwin_amd64.tar.gz',
      sha256: '0724f64f38f9389497da71795751e5f1b48fd4fc43aa752241b020c0772d5cd8',
    },
    {
      platform: PluginPlatform.DARWIN,
      architecture: PluginArchitecture.ARM64,
      bundle_type: PluginBundleType.TAR_GZ,
      executable_path: 'oras',
      url: 'https://github.com/oras-project/oras/releases/download/v0.15.0/oras_0.15.0_darwin_arm64.tar.gz',
      sha256: '7889cee33ba2147678642cbd909be81ec9996f62c57c53b417f7c21c8d282334',
    },
  ];

  async load(pluginDirectory: string, binary: PluginBinary): Promise<void> {
    this.binary = binary;
    this.plugin_directory = pluginDirectory;
    const tar_file_path = path.join(pluginDirectory, '/oras.tar.gz');

    if ((await fs.pathExists(path.join(this.plugin_directory, `/${this.binary?.executable_path}`)))) {
      // Plugin is already loaded
      return;
    }

    await PluginUtils.downloadFile(binary.url, tar_file_path, binary.sha256);
    await PluginUtils.extractFile(tar_file_path, pluginDirectory, binary.bundle_type);
    await fs.remove(tar_file_path);
  }

  async exec(args: string[], opts: PluginOptions): Promise<execa.ExecaChildProcess<string> | undefined> {
    if (process.env.TEST === '1') {
      return undefined;
    }

    const cmd = execa(path.join(this.plugin_directory, `/${this.binary?.executable_path}`), args, opts.execa_options);
    if (opts.stdout) {
      cmd.stdout?.pipe(process.stdout);
      cmd.stderr?.pipe(process.stderr);
    }
    return await cmd;
  }

  async push(url: string, tarFile: string, cwd: string): Promise<void> {
    this.exec(['push', url, tarFile], {
      stdout: true,
      execa_options: {
        cwd: cwd,
      },
    });
  }
}
