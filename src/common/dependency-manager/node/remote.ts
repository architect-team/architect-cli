import DependencyNode, { NodeOptions, PrivateNodeOptions } from '.';
import PortManager from '../../port-manager';

interface RemoteNodeOptions extends NodeOptions {
  image: string;
}

interface PrivateRemoteNodeOptions extends PrivateNodeOptions {
  image: string;
}

export class RemoteDependencyNode extends DependencyNode {
  image: string;

  static async create(options: RemoteNodeOptions) {
    const expose_port = await PortManager.getAvailablePort();
    return new RemoteDependencyNode({
      ...options,
      expose_port,
    });
  }

  constructor(options: PrivateRemoteNodeOptions) {
    super(options);
    this.image = options.image;
  }
}
