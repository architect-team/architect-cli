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
    const prefix = this.parent_ref ? `external.${this.parent_ref.split(':')[0]}` : 'external';
    return `${prefix}.${this.key}`;
  }

  get ref() {
    const prefix = this.parent_ref ? `external.${this.parent_ref}` : 'external';
    return `${prefix}.${this.key}`;
  }
}
