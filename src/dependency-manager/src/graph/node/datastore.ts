import { DependencyNode, DependencyNodeOptions } from '.';

interface DatastoreNodeOptions {
  parent_ref: string;
  key: string;
  image: string;
  replicas?: number;
}

export class DatastoreNode extends DependencyNode {
  __type = 'datastore';
  parent_ref!: string;
  key!: string;

  image!: string;
  replicas = 1;

  constructor(options: DependencyNodeOptions & DatastoreNodeOptions) {
    super(options);
  }

  get env_ref() {
    return `${this.parent_ref.split(':')[0]}.${this.key}`;
  }

  get ref() {
    return `${this.parent_ref}.${this.key}`;
  }
}
