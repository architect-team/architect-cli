import { DatastoreValueFromParameter, ValueFromParameter } from '../manager';

interface RestSubscriptionData {
  uri: string;
  headers?: { [key: string]: string };
}

export interface ServiceParameter {
  description: string;
  default?: string | number | ValueFromParameter | DatastoreValueFromParameter;
  aliases: string[];
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

export interface ServiceInterfaceSpec {
  description?: string;
  port?: number;
}

export interface ServiceLivenessProbe {
  success_threshold?: number;
  failure_threshold?: number;
  timeout?: string;
  path?: string;
  interval?: string;
}

export interface ServiceDebugOptions {
  command: string | string[];
}

export abstract class ServiceConfig {
  abstract __version: string;
  abstract getName(): string;
  abstract getLanguage(): string;
  abstract getImage(): string;
  abstract getCommand(): string | string[];
  abstract getDependencies(): { [s: string]: string };
  abstract getParameters(): { [s: string]: ServiceParameter };
  abstract getDatastores(): { [s: string]: ServiceDatastore };
  abstract getApiSpec(): ServiceApiSpec;
  abstract getInterfaces(): { [s: string]: ServiceInterfaceSpec };
  abstract getNotifications(): ServiceEventNotifications;
  abstract getSubscriptions(): ServiceEventSubscriptions;
  abstract getDebugOptions(): ServiceDebugOptions | undefined;
  abstract getPlatforms(): { [s: string]: any };
  abstract addDependency(dependency_name: string, dependency_tag: string): void;
  abstract removeDependency(dependency_name: string): void;
  abstract getPort(): number | undefined;
}
