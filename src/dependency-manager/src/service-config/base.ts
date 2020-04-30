import { classToClass, plainToClassFromExist } from 'class-transformer';
import { BaseSpec } from '../utils/base-spec';

export interface VaultParameter {
  vault: string;
  key: string;
}

export interface DependencyParameter {
  dependency: string;
  value: string;
  interface?: string;
}

export interface DatastoreParameter {
  datastore: string;
  value: string;
}

export interface ValueFromParameter<T> {
  valueFrom: T;
}

export type ParameterValue = string | number | ValueFromParameter<DependencyParameter | VaultParameter | DatastoreParameter>;

interface RestSubscriptionData {
  uri: string;
  headers?: { [key: string]: string };
}

export interface ServiceParameter {
  description: string;
  default?: ParameterValue;
  required: boolean;
  build_arg?: boolean;
}

export interface ServiceDatastore {
  host?: string;
  port?: number;
  image?: string;
  parameters: {
    [key: string]: ServiceParameter;
  };
}

export interface ServiceEventNotifications {
  [notification_name: string]: {
    description: string;
  };
}

export interface ServiceEventSubscriptions {
  [service_ref: string]: {
    [event_name: string]: {
      type: string;
      data: RestSubscriptionData;
    };
  };
}

export interface ServiceApiSpec {
  type: string;
  definitions?: string[];
  liveness_probe?: ServiceLivenessProbe;
}

export interface ServiceInterfaceSpec {
  description?: string;
  host?: string;
  port: number;
}

export interface ServiceLivenessProbe {
  success_threshold?: number;
  failure_threshold?: number;
  timeout?: string;
  path?: string;
  interval?: string;
}

export interface VolumeSpec {
  mount_path?: string;
  host_path?: string;
  description?: string;
  readonly?: boolean;
}

export interface IngressSpec {
  subdomain: string;
}

export abstract class ServiceConfig extends BaseSpec {
  abstract __version: string;
  abstract getPath(): string | undefined;
  abstract getExtends(): string | undefined;
  abstract getRef(): string;
  abstract setParentRef(ref: string): void;
  abstract getParentRef(): string | undefined;
  abstract getPrivate(): boolean;
  abstract getName(): string;
  abstract getLanguage(): string;
  abstract getImage(): string;
  abstract setImage(image: string): void;
  abstract getDigest(): string | undefined;
  abstract setDigest(digest: string): void;
  abstract getCommand(): string | string[];
  abstract getEntrypoint(): string | string[];
  abstract getDockerfile(): string | undefined;
  abstract getDependencies(): { [s: string]: ServiceConfig };
  abstract getParameters(): { [s: string]: ServiceParameter };
  abstract getDatastores(): { [s: string]: ServiceDatastore };
  abstract getApiSpec(): ServiceApiSpec;
  abstract getInterfaces(): { [s: string]: ServiceInterfaceSpec };
  abstract getNotifications(): ServiceEventNotifications;
  abstract getSubscriptions(): ServiceEventSubscriptions;
  abstract getDebugOptions(): ServiceConfig | undefined;
  abstract setDebugPath(debug_path: string): void;
  abstract getPlatforms(): { [s: string]: any };
  abstract addDependency(dependency_name: string, dependency_tag: string): void;
  abstract removeDependency(dependency_name: string): void;
  abstract getPort(): number | undefined;
  abstract getVolumes(): { [s: string]: VolumeSpec };
  abstract getIngress(): IngressSpec | undefined;
  abstract getReplicas(): number;

  copy() {
    return classToClass(this);
  }

  merge(other_config: ServiceConfig): ServiceConfig {
    return plainToClassFromExist(this.copy(), other_config);
  }
}
