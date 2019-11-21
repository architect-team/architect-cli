import { DependencyNode, DependencyNodeOptions } from '.';

export interface ServiceNodeOptions {
  subscriptions?: {
    [service_name: string]: {
      [event_name: string]: {
        uri: string;
        headers?: { [key: string]: string };
      };
    };
  };
  api: {
    type: string;
    definitions?: string[];
  };
  language?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  subscriptions: { [service_name: string]: { [event_name: string]: { uri: string; headers?: { [key: string]: string } | undefined } } };
  api: { type: string; definitions?: string[] | undefined };
  language?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.subscriptions = options.subscriptions || {};
    this.api = options.api;
    this.language = options.language;
  }
}
