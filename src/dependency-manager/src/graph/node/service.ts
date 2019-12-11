import { DependencyNode, DependencyNodeOptions } from '.';

export interface ServiceNodeOptions {
  api: {
    type: string;
    definitions?: string[];
  };
  language?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';
  api!: { type: string; definitions?: string[] | undefined };
  language?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
  }

  /**
   * @override
   */
  get protocol() {
    return this.api.type === 'grpc' ? '' : 'http://';
  }
}
