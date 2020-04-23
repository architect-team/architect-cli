import { BaseSpec } from '../base-spec';

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
  mount_path: string;
  description?: string;
  readonly?: boolean;
}

export type BaseParameterConfig = BaseParameterValueConfig | BaseParameterValueFromConfig;

export abstract class BaseServiceConfig extends BaseSpec {
  abstract copy(): BaseServiceConfig;

  abstract getRef(): string;
  abstract setRef(ref: string): void;

  abstract getName(): string;
  abstract setName(name: string): void;

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

  abstract getCommand(debug?: boolean): string | string[] | undefined;
  abstract setCommand(command?: string | string[]): void;

  abstract getEntrypoint(debug?: boolean): string | string[] | undefined;
  abstract setEntrypoint(entrypoint?: string | string[]): void;

  abstract getDockerfile(debug?: boolean): string | undefined;
  abstract setDockerfile(dockerfile?: string): void;

  abstract getLivenessProbe(): BaseLivenessProbeConfig;
  abstract setLivenessProbe(liveness_probe: BaseLivenessProbeConfig): void;

  abstract getNotifications(): Map<string, BaseNotificationConfig>;
  abstract setNotifications(notifications: Map<string, BaseNotificationConfig>): void;

  abstract getSubscriptions(): Map<string, Map<string, BaseSubscriptionConfig>>;
  abstract setSubscriptions(subscriptions: Map<string, Map<string, BaseSubscriptionConfig>>): void;

  abstract getPlatformsConfig(): BasePlatformsConfig;
  abstract setPlatformsConfig(platforms: BasePlatformsConfig): void;

  public getNormalizedRef() {
    if (this.getRef() && /^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+\:[a-zA-Z0-9-_]+$/.test(this.getRef())) {
      return this.getRef();
    } else if (this.getRef() && this.getName()) {
      return `${this.getName()}:${this.getRef()}`;
    }

    return this.getName();
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
    this.setDockerfile(config.getDockerfile() || this.getDockerfile());
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

    // TODO: populate other getters/setters
  }

  public static copy<T extends BaseServiceConfig>(this: new () => T, config: BaseServiceConfig): T {
    const copy = new this();
    copy.merge(config);
    return copy;
  }
}
