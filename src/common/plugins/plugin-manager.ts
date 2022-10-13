import * as fs from 'fs-extra';
import path from 'path';
import { Dictionary } from '../..';
import { ArchitectPlugin, PluginArchitecture, PluginBundleType, PluginPlatform } from './plugin-types';
import PluginUtils from './plugin-utils';

export default class PluginManager {
  private static readonly plugins: Dictionary<ArchitectPlugin> = {};

  private static readonly ARCHITECTURE_MAP: Dictionary<PluginArchitecture> = {
    'x64': PluginArchitecture.AMD64,
    'arm64': PluginArchitecture.ARM64,
  };

  private static readonly OPERATIN_SYSTEM_MAP: Dictionary<PluginPlatform> = {
    'win32': PluginPlatform.WINDOWS,
    'darwin': PluginPlatform.DARWIN,
    'linux': PluginPlatform.LINUX,
  };

  private static getPlatform(): PluginPlatform {
    return this.OPERATIN_SYSTEM_MAP[process.platform];
  }

  private static getArchitecture(): PluginArchitecture {
    return this.ARCHITECTURE_MAP[process.arch];
  }

  private static async removeOldPluginVersions(pluginDirectory: string, version: string) {
    if (!(await fs.pathExists(pluginDirectory))) {
      return;
    }
    const downloaded_versions = await fs.readdir(pluginDirectory);
    for (const downloaded_version of downloaded_versions) {
      if (downloaded_version === version) {
        continue;
      }
      await fs.remove(path.join(pluginDirectory, downloaded_version));
    }
  }

  static async getPlugin<T extends ArchitectPlugin>(pluginDirectory: string, ctor: { new(): T; }): Promise<T> {
    if (this.plugins[ctor.name]) {
      return this.plugins[ctor.name] as T;
    }
    const plugin = new ctor();
    const current_plugin_directory = path.join(pluginDirectory, `/${plugin.name}`);
    const version_path = path.join(current_plugin_directory, `/${plugin.version}`);

    await this.removeOldPluginVersions(current_plugin_directory, plugin.version);
    await fs.mkdirp(version_path);

    const binary = PluginUtils.getBinary(plugin.binaries, this.getPlatform(), this.getArchitecture());
    const downloaded_file_path = path.join(version_path, `/${plugin.name}.${binary.bundle_type === PluginBundleType.ZIP ? 'zip' : 'tar.gz'}`);

    if (!(await fs.pathExists(path.join(version_path, `/${binary.executable_path}`)))) {
      await PluginUtils.downloadFile(binary.url, downloaded_file_path, binary.sha256);
      await PluginUtils.extractFile(downloaded_file_path, version_path, binary.bundle_type);
      await fs.remove(downloaded_file_path);
    }

    await plugin.setup(version_path, PluginUtils.getBinary(plugin.binaries, this.getPlatform(), this.getArchitecture()));

    this.plugins[ctor.name] = plugin;
    return plugin as T;
  }
}
