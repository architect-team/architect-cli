import DependencyNode, { NodeOptions, PrivateNodeOptions } from '.';
import PortManager from '../../port-manager';

interface LocalNodeOptions extends NodeOptions {
  service_path: string;
  command?: string;
}

interface PrivateLocalNodeOptions extends PrivateNodeOptions {
  service_path: string;
  command?: string;
}

export class LocalDependencyNode extends DependencyNode {
  service_path: string;
  command?: string;

  static async create(options: LocalNodeOptions) {
    const expose_port = await PortManager.getAvailablePort();
    return new LocalDependencyNode({
      ...options,
      expose_port,
    });
  }

  private constructor(options: PrivateLocalNodeOptions) {
    super(options);
    this.service_path = options.service_path;
    this.command = options.command;
  }
}
