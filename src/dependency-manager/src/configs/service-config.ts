import fs from 'fs';
import path from 'path';
import { BaseSpec } from './base-spec';

export interface BaseBuildConfig {
  dockerfile?: string;
  args?: string[];
  context?: string;
}

export interface BaseServiceMetadataConfig {
  description?: string;
  tags?: string[];
  language?: string;
}

export interface BaseInterfaceConfig {
  description?: string;
  default?: boolean;
  port?: number;
  host?: string;
}

export interface BaseLivenessProbeConfig {
  success_threshold?: number;
  failure_threshold?: number;
  timeout?: string;
  path?: string;
  interval?: string;
}

export interface BaseNotificationConfig {
  description?: string;
}

export interface BaseSubscriptionConfig {
  uri: string;
  headers: Map<string, string>;
}

export interface BasePlatformsConfig {
  'docker-compose'?: {
    privileged?: boolean;
    stop_signal?: string;
  };
}

export interface BaseValueFromVaultConfig {
  vault: string;
  key: string;
}

export interface BaseValueFromDependencyConfig {
  dependency: string;
  value: string;
}

export interface BaseParameterValueFromConfig {
  value_from: BaseValueFromDependencyConfig | BaseValueFromVaultConfig;
}

export interface BaseParameterValueConfig {
  description?: string;
  default?: string | number;
  required?: boolean;
}

export interface BaseVolumeConfig {
  host_path?: string;
  mount_path?: string;
  description?: string;
  readonly?: boolean;
}

export type BaseParameterConfig = BaseParameterValueConfig | BaseParameterValueFromConfig;

export abstract class BaseServiceConfig extends BaseSpec {
  abstract getRef(): string | undefined;
  abstract setRef(ref?: string): void;

  abstract getName(): string | undefined;
  abstract setName(name?: string): void;

  abstract getMetadata(): BaseServiceMetadataConfig;
  abstract setMetadata(metadata: BaseServiceMetadataConfig): void;

  abstract getInterfaces(): Map<string, BaseInterfaceConfig>;
  abstract setInterfaces(interfaces: Map<string, BaseInterfaceConfig>): void;

  abstract getParameters(): Map<string, BaseParameterConfig>;
  abstract setParameters(parameters: Map<string, BaseParameterConfig>): void;

  abstract getDependencies(): Array<BaseServiceConfig>;
  abstract setDependencies(dependencies: Array<BaseServiceConfig>): void;

  abstract getVolumes(): Map<string, BaseVolumeConfig>;
  abstract setVolumes(volumes: Map<string, BaseVolumeConfig>): void;

  abstract getImage(): string | undefined;
  abstract setImage(image?: string): void;

  abstract getCommand(): string | string[] | undefined;
  abstract setCommand(command?: string | string[]): void;

  abstract getEntrypoint(): string | string[] | undefined;
  abstract setEntrypoint(entrypoint?: string | string[]): void;

  abstract getBuildConfig(): BaseBuildConfig | undefined;
  abstract setBuildConfig(config?: BaseBuildConfig): void;

  abstract getLivenessProbe(): BaseLivenessProbeConfig | undefined;
  abstract setLivenessProbe(liveness_probe?: BaseLivenessProbeConfig): void;

  abstract getNotifications(): Map<string, BaseNotificationConfig>;
  abstract setNotifications(notifications: Map<string, BaseNotificationConfig>): void;

  abstract getSubscriptions(): Map<string, Map<string, BaseSubscriptionConfig>>;
  abstract setSubscriptions(subscriptions: Map<string, Map<string, BaseSubscriptionConfig>>): void;

  abstract getPlatformsConfig(): BasePlatformsConfig;
  abstract setPlatformsConfig(platforms: BasePlatformsConfig): void;

  abstract getDebugPath(): string | undefined;
  abstract setDebugPath(debug_path?: string): void;

  abstract getDebugCommand(): string | string[] | undefined;
  abstract setDebugCommand(command?: string | string[]): void;

  abstract getDebugEntrypoint(): string | string[] | undefined;
  abstract setDebugEntrypoint(entrypoint?: string | string[]): void;

  abstract getDebugVolumes(): Map<string, BaseVolumeConfig>;
  abstract setDebugVolumes(volumes: Map<string, BaseVolumeConfig>): void;

  /**
   * Retrieve the fully resolvable service ref (e.g. <account>/<name>:<tag>) of the service
   */
  public getResolvableRef(): string {
    const ref = this.getRef();
    const name = this.getName();

    if (ref && /^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+\:[a-zA-Z0-9-_]+$/.test(ref)) {
      return ref;
    } else if (ref && name) {
      return `${name}:${ref}`;
    } else if (name) {
      return name;
    }

    throw new Error('A name or ref is required on all services');
  }

  /**
   * Get all the volumes for the service
   * @param debug [boolean] whether or not to include debug volumes (default: false)
   */
  public getResolvableVolumes(debug = false): Map<string, BaseVolumeConfig> {
    const res = this.getVolumes();
    if (debug) {
      return new Map([
        ...res,
        ...this.getDebugVolumes(),
      ]);
    }

    const debug_path = this.getDebugPath();
    if (debug_path) {
      res.forEach((value, key) => {
        if (value.host_path) {
          value.host_path = path.join(debug_path, value.host_path);
          res.set(key, value);
        }
      });
    }

    return res;
  }

  /**
   * Combine the build context with the debug path (if it exists) to consolidate
   * the object for build-time operations.
   */
  public getResolvableBuildConfig(): BaseBuildConfig | undefined {
    let debug_path = this.getDebugPath();
    if (debug_path) {
      const debug_path_lstat = fs.lstatSync(debug_path);
      if (debug_path_lstat.isFile()) {
        debug_path = path.dirname(debug_path);
      }
    }

    let build_config = this.getBuildConfig();

    if (!debug_path && !build_config || this.getImage()) {
      return undefined;
    }

    build_config = build_config || {};
    if (build_config.context && debug_path) {
      build_config.context = path.join(debug_path, build_config.context);
    } else if (debug_path) {
      build_config.context = debug_path;
    }

    if (build_config.dockerfile && debug_path) {
      build_config.dockerfile = path.join(debug_path, build_config.dockerfile);
    }

    return build_config;
  }

  /**
   * Get either the debug or default command to run
   * @param debug [boolean] (default: false)
   */
  public getPrioritizedCommand(debug = false) {
    if (debug) {
      return this.getDebugCommand() || this.getCommand();
    }

    return this.getCommand();
  }

  /**
   * Get either the debug or default entrypoint to run
   * @param debug [boolean] (default: false)
   */
  public getPrioritizedEntrypoint(debug = false) {
    if (debug) {
      return this.getDebugEntrypoint() || this.getEntrypoint();
    }

    return this.getEntrypoint();
  }

  public merge(config: BaseServiceConfig) {
    this.setRef(config.getRef() || this.getRef());
    this.setName(config.getName() || this.getName());
    this.setMetadata({
      ...this.getMetadata(),
      ...config.getMetadata(),
    });
    this.setInterfaces(new Map([
      ...this.getInterfaces(),
      ...config.getInterfaces(),
    ]));
    this.setParameters(new Map([
      ...this.getParameters(),
      ...config.getParameters(),
    ]));
    this.setVolumes(new Map([
      ...this.getVolumes(),
      ...config.getVolumes(),
    ]));
    this.setDependencies([
      ...this.getDependencies(),
      ...config.getDependencies(),
    ]);
    this.setCommand(config.getCommand() || this.getCommand());
    this.setEntrypoint(config.getEntrypoint() || this.getEntrypoint());
    this.setImage(config.getImage() || this.getImage());
    this.setBuildConfig(config.getBuildConfig() || this.getBuildConfig());
    this.setLivenessProbe({
      ...this.getLivenessProbe(),
      ...config.getLivenessProbe(),
    });
    this.setNotifications(new Map([
      ...this.getNotifications(),
      ...config.getNotifications(),
    ]));
    this.setSubscriptions(new Map([
      ...this.getSubscriptions(),
      ...config.getSubscriptions(),
    ]));
    this.setPlatformsConfig({
      ...this.getPlatformsConfig(),
      ...config.getPlatformsConfig(),
    });
    this.setDebugPath(config.getDebugPath() || this.getDebugPath());
    this.setDebugCommand(config.getDebugCommand() || this.getDebugCommand());
    this.setDebugEntrypoint(config.getDebugEntrypoint() || this.getDebugEntrypoint());
    this.setDebugVolumes(config.getDebugVolumes() || this.getDebugVolumes());

    // TODO: populate other getters/setters
  }

  public static copy<T extends BaseServiceConfig>(this: new () => T, config: BaseServiceConfig): T {
    const copy = new this();
    copy.merge(config);
    return copy;
  }
}
