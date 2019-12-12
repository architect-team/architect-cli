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
  }

  get ref() {
    return `${this.parent_ref}.${this.key}`;
  }
}
