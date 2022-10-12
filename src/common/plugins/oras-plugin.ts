import execa from 'execa';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ArchitectPlugin, PluginArchitecture, PluginOperatingSystem, PluginOptions } from './plugin-manager';
import PluginUtils from './plugin-utils';

export default class OrasPlugin implements ArchitectPlugin {
  private readonly DOWNLOAD_URL = "https://github.com/oras-project/oras/releases/download/v0.15.0/oras_0.15.0_<os>_<architecture>.tar.gz";
  private oras_executable_location = '';

  async load(pluginDirectory: string, architecture: PluginArchitecture, operatingSystem: PluginOperatingSystem): Promise<void> {
    const download_url = this.DOWNLOAD_URL.replace('<os>', PluginOperatingSystem[operatingSystem].toLowerCase()).replace('<architecture>', PluginArchitecture[architecture].toString().toLowerCase());
    const oras_plugin_dir = path.join(pluginDirectory, `/${OrasPlugin.name}`);
    const tar_file_path = path.join(oras_plugin_dir, '/oras.tar.gz');
    this.oras_executable_location = path.join(oras_plugin_dir, '/oras');

    if ((await fs.pathExists(this.oras_executable_location))) {
      // Plugin is already loaded
      return;
    }

    await fs.mkdirp(oras_plugin_dir);
    await PluginUtils.downloadFile(download_url, tar_file_path);
    await PluginUtils.extractTarGz(tar_file_path, oras_plugin_dir);
    await fs.remove(tar_file_path);
  }

  async exec(args: string[], opts: PluginOptions): Promise<execa.ExecaChildProcess<string> | undefined> {
    if (process.env.TEST === '1') {
      return undefined;
    }

    const cmd = execa(this.oras_executable_location, args, opts.execa_options);
    if (opts.stdout) {
      cmd.stdout?.pipe(process.stdout);
      cmd.stderr?.pipe(process.stderr);
    }
    return await cmd;
  }

  async push(url: string, tar_file: string, cwd: string): Promise<void> {
    this.exec(['push', url, tar_file], {
      stdout: true,
      execa_options: {
        cwd: cwd,
      },
    });
  }
}
