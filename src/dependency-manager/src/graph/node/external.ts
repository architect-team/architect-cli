import { DependencyNode, DependencyNodeOptions } from '.';

interface ExternalNodeOptions {
  parent_ref: string;
  key: string;
}

export class ExternalNode extends DependencyNode {
  __type = 'external';
  parent_ref!: string;
  key!: string;

  constructor(options: DependencyNodeOptions & ExternalNodeOptions) {
    super(options);
    if (options) {
      this.parent_ref = options.parent_ref;
      this.key = options.key;
    }
  }

  get env_ref() {
    return `${this.parent_ref.split(':')[0]}.${this.key}`;
  }

  get ref() {
    return `${this.parent_ref}.${this.key}`;
  }
}
