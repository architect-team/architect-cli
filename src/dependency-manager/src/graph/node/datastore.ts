import { DependencyNode, DependencyNodeOptions } from '.';

interface DatastoreNodeOptions {
  key: string;
}

export class DatastoreNode extends DependencyNode {
  __type = 'datastore';
  key!: string;

  constructor(options: DependencyNodeOptions & DatastoreNodeOptions) {
    super(options);
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
    return `${super.ref}.${this.key}`;
  }
}
