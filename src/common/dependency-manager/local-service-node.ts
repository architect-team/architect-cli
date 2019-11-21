import { DependencyNode, DependencyNodeOptions, ServiceEventSubscriptions } from '../../dependency-manager/src';

interface LocalServiceNodeOptions {
  service_path: string;
  command?: string;
  subscriptions: ServiceEventSubscriptions;
  api: {
    type: string;
    definitions?: string[];
  };
}

export class LocalServiceNode extends DependencyNode implements LocalServiceNodeOptions {
  service_path: string;
  command?: string;
  subscriptions: ServiceEventSubscriptions;
  api: { type: string; definitions?: string[] };

  constructor(options: LocalServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.service_path   = options.service_path;
    this.command        = options.command;
    this.subscriptions  = options.subscriptions || {};
    this.api            = options.api;
  }
}
