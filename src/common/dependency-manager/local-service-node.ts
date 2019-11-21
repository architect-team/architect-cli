import { DependencyNode, DependencyNodeOptions } from '../../dependency-manager/src';

interface LocalServiceNodeOptions {
  service_path: string;
  command?: string;
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

export class LocalServiceNode extends DependencyNode implements LocalServiceNodeOptions {
  service_path: string;
  command?: string | undefined;
  subscriptions?: { [service_name: string]: { [event_name: string]: { uri: string; headers?: { [key: string]: string; } | undefined; }; }; } | undefined;
  api: { type: string; definitions?: string[] | undefined; };

  constructor(options: LocalServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.service_path   = options.service_path;
    this.subscriptions  = options.subscriptions;
    this.api            = options.api;
  }
}
