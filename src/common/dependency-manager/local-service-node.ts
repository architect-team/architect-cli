import { DependencyNode, DependencyNodeOptions } from '../../dependency-manager/src';

interface LocalServiceNodeOptions {
  service_path: string;
  command?: string;
  api: {
    type: string;
    definitions?: string[];
  };
}

export class LocalServiceNode extends DependencyNode implements LocalServiceNodeOptions {
  __type = 'local';
  service_path!: string;
  command?: string;
  api!: { type: string; definitions?: string[] };

  constructor(options: LocalServiceNodeOptions & DependencyNodeOptions) {
    super(options);
  }

  get protocol() {
    return this.api.type === 'grpc' ? '' : 'http://';
  }
}
