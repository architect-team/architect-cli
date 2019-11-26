import { DependencyNode, DependencyNodeOptions } from '.';

export interface ServiceNodeOptions {
  api: {
    type: string;
    definitions?: string[];
  };
  language?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  api: { type: string; definitions?: string[] | undefined };
  language?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    this.api = options.api;
    this.language = options.language;
  }

  /**
   * @override
   */
  get protocol() {
    return this.api.type === 'grpc' ? '' : 'http://';
  }
}
