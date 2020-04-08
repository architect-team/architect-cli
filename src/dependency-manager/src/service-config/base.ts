import { DatastoreValueFromParameter, ValueFromParameter } from '../manager';

interface RestSubscriptionData {
  uri: string;
  headers?: { [key: string]: string };
}

export interface ServiceParameter {
  description: string;
  default?: string | number | ValueFromParameter | DatastoreValueFromParameter;
  required: boolean;
  build_arg?: boolean;
}

export interface ServiceDatastore {
  docker: {
    image: string;
    target_port: number;
  };
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
      type: 'rest';
      data: RestSubscriptionData;
    };
  };
}

export interface ServiceApiSpec {
  type: string;
  definitions?: string[];
  liveness_probe?: ServiceLivenessProbe;
}

export interface ServiceLivenessProbe {
  success_threshold?: number;
  failure_threshold?: number;
  timeout?: string;
  path?: string;
  interval?: string;
}

export interface ServiceDockerSpec {
  dockerfile?: string;
  context?: string;
  command?: string | string[];
  entrypoint?: string | string[];
}

export interface ServiceDebugOptions {
  docker?: ServiceDockerSpec;
}

export abstract class ServiceConfig {
  abstract __version: string;
  abstract getName(): string;
  abstract getLanguage(): string;
  abstract getImage(): string;
  abstract getDockerOptions(): ServiceDockerSpec;
  abstract getCommand(): string | string[];
  abstract getEntrypoint(): string | string[];
  abstract getDependencies(): { [s: string]: string };
  abstract getParameters(): { [s: string]: ServiceParameter };
  abstract getDatastores(): { [s: string]: ServiceDatastore };
  abstract getApiSpec(): ServiceApiSpec;
  abstract getNotifications(): ServiceEventNotifications;
  abstract getSubscriptions(): ServiceEventSubscriptions;
  abstract getDebugOptions(): ServiceDebugOptions;
  abstract getPlatforms(): { [s: string]: any };
  abstract addDependency(dependency_name: string, dependency_tag: string): void;
  abstract removeDependency(dependency_name: string): void;
  abstract getPort(): number | undefined;
}
