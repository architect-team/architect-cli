import { DependencyNodeOptions, DependencyNode } from '.';

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
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  subscriptions: { [service_name: string]: { [event_name: string]: { uri: string; headers?: { [key: string]: string } | undefined } } };
  api: { type: string; definitions?: string[] | undefined };

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.subscriptions  = options.subscriptions || {};
    this.api            = options.api;
  }
}
