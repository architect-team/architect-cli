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
}

export interface ServiceDebugOptions {
  command: string;
}

export abstract class ServiceConfig {
  abstract getName(): string;
  abstract getLanguage(): string;
  abstract getDependencies(): { [s: string]: string };
  abstract getParameters(): { [s: string]: ServiceParameter };
  abstract getDatastores(): { [s: string]: ServiceDatastore };
  abstract getApiSpec(): ServiceApiSpec;
  abstract getSubscriptions(): ServiceEventSubscriptions;
  abstract getDebugOptions(): ServiceDebugOptions | undefined;
  abstract addDependency(dependency_name: string, dependency_tag: string): void;
  abstract removeDependency(dependency_name: string): void;
}
