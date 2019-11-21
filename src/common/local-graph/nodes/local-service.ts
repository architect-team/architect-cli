import { DependencyNodeOptions, ServiceNodeOptions, DependencyNode } from '../../../dependency-manager/src';

interface LocalServiceNodeOptions extends ServiceNodeOptions {
  service_path: string;
  command?: string;
}

export default class LocalServiceNode extends DependencyNode implements LocalServiceNodeOptions {
  service_path: string;
  command?: string | undefined;
  subscriptions: { [service_name: string]: { [event_name: string]: { uri: string; headers?: { [key: string]: string } | undefined } } };
  api: { type: string; definitions?: string[] | undefined };

  constructor(options: LocalServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.service_path   = options.service_path;
    this.command        = options.command;
    this.subscriptions  = options.subscriptions || {};
    this.api            = options.api;
  }
}
