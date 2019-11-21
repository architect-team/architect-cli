import { DependencyNodeOptions, DependencyNode } from '.';

export class DatastoreNode extends DependencyNode {
  constructor(options: DependencyNodeOptions) {
    super(options);
  }

  /**
   * @override
   */
  get ref() {
    return this.name;
  }
}
