import { DependencyNode, DependencyNodeOptions } from '.';

interface DatastoreNodeOptions {
  key: string;
}

export class DatastoreNode extends DependencyNode {
  key: string;

  constructor(options: DependencyNodeOptions & DatastoreNodeOptions) {
    super(options);
    this.key = options.key;
  }

  /**
   * @override
   */
  get name() {
    return `${super.name}.${this.key}`;
  }

  /**
   * @override
   */
  get ref() {
    return `${super.ref}.${this.name}`;
  }
}
