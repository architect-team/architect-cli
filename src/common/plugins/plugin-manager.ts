import execa, { Options } from 'execa';
import { Dictionary } from '../..';

export enum PluginArchitecture {
  AMD64, ARM64
}

export enum PluginOperatingSystem {
  LINUX, DARWIN, WINDOWS
}

export interface PluginOptions {
  stdout: boolean;
  execa_options?: Options<string>;
}

// Must be a class to pass type into getPlugin function
// interfaces do not have a typeof
export class ArchitectPlugin {
  async load(pluginDirectory: string, architecture: PluginArchitecture, operatingSystem: PluginOperatingSystem): Promise<void> {
    throw new Error('Cannot call load for ArchitectPlugin base class');
  }
  async exec(args: string[], opts: PluginOptions): Promise<execa.ExecaChildProcess<string> | undefined> {
    throw new Error('Cannot exec load for ArchitectPlugin base class');
  }
}

export default class PluginManager {
  private static readonly plugins: Dictionary<ArchitectPlugin> = {};

  private static readonly ARCHITECTURE_MAP: Dictionary<PluginArchitecture> = {
    'x64': PluginArchitecture.AMD64,
    'arm64': PluginArchitecture.ARM64,
  };

  private static readonly OPERATIN_SYSTEM_MAP: Dictionary<PluginOperatingSystem> = {
    'win32': PluginOperatingSystem.WINDOWS,
    'darwin': PluginOperatingSystem.DARWIN,
    'linux': PluginOperatingSystem.LINUX,
  };

  private static getOperatingSystem(): PluginOperatingSystem {
    return this.OPERATIN_SYSTEM_MAP[process.platform];
  }

  private static getArchitecture(): PluginArchitecture {
    return this.ARCHITECTURE_MAP[process.arch];
  }

  static async getPlugin<T extends ArchitectPlugin>(pluginDirectory: string, ctor: typeof ArchitectPlugin): Promise<T> {
    if (this.plugins[ctor.name]) {
      return this.plugins[ctor.name] as T;
    }
    const plugin = new ctor();
    await plugin.load(pluginDirectory, this.getArchitecture(), this.getOperatingSystem());

    this.plugins[ctor.name] = plugin;
    return plugin as T;
  }
}
