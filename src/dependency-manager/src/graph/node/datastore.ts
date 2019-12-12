import { DependencyNode, DependencyNodeOptions } from '.';

interface DatastoreNodeOptions {
  parent_ref: string;
  key: string;
  image: string;
}

export class DatastoreNode extends DependencyNode {
  __type = 'datastore';
  parent_ref!: string;
  key!: string;

  image!: string;

  constructor(options: DependencyNodeOptions & DatastoreNodeOptions) {
    super(options);
  }

  get ref() {
    return `${this.parent_ref}.${this.key}`;
  }
}
