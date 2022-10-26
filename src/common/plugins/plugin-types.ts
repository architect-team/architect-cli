import execa, { Options } from 'execa';

export enum PluginArchitecture {
  AMD64, ARM64
}

export enum PluginPlatform {
  LINUX, DARWIN, WINDOWS
}

export enum PluginBundleType {
  ZIP, TAR_GZ
}

export interface PluginOptions {
  stdout: boolean;
  execa_options?: Options<string>;
}

export interface PluginBinary {
  url: string;
  architecture: PluginArchitecture;
  platform: PluginPlatform;
  sha256: string;
  bundle_type: PluginBundleType;
  executable_path: string;
}

export interface ArchitectPlugin {
  version: string;
  name: string;
  binaries: PluginBinary[];
  setup(pluginDirectory: string, binary: PluginBinary): Promise<void>;
  exec(args: string[], opts: PluginOptions): Promise<execa.ExecaChildProcess<string> | undefined>;
}
