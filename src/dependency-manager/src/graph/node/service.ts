import { DependencyNodeOptions, DependencyNode } from '.';
import { ServiceEventSubscriptions } from '../../service-config/base';

export interface ServiceNodeOptions {
  subscriptions?: ServiceEventSubscriptions;
  api: {
    type: string;
    definitions?: string[];
  };
  language?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  subscriptions: ServiceEventSubscriptions;
  api: { type: string; definitions?: string[] | undefined };
  language?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.subscriptions = options.subscriptions || {};
    this.api = options.api;
    this.language = options.language;
  }
}
