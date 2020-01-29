import { DependencyNode, DependencyNodeOptions } from '.';

interface ExternalNodeOptions {
  parent_ref?: string;
  key: string;
  host: string;
}

export class ExternalNode extends DependencyNode {
  __type = 'external';
  parent_ref?: string;
  key!: string;
  host!: string;

  constructor(options: DependencyNodeOptions & ExternalNodeOptions) {
    super(options);
    if (options) {
      this.parent_ref = options.parent_ref;
      this.key = options.key;
      this.host = options.host;
    }
  }

  get env_ref() {
    return this.parent_ref ? `${this.parent_ref.split(':')[0]}.${this.key}` : this.key.split(':')[0];
  }

  get ref() {
    return this.parent_ref ? `${this.parent_ref}.${this.key}` : this.key;
  }
}
