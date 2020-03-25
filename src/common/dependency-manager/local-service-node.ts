import { DependencyNodeOptions, ServiceNode, ServiceNodeOptions } from '../../dependency-manager/src';

interface LocalServiceNodeOptions {
  service_path: string;
}

export class LocalServiceNode extends ServiceNode implements LocalServiceNodeOptions {
  __type = 'local';
  service_path!: string;

  constructor(options: LocalServiceNodeOptions & ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    if (options) {
      this.service_path = options.service_path;
    }
  }
}
