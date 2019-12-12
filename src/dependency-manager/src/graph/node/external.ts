import { DependencyNode, DependencyNodeOptions } from '.';

interface ExternalNodeOptions {
  key: string;
}

export class ExternalNode extends DependencyNode {
  __type = 'external';
  key!: string;

  constructor(options: DependencyNodeOptions & ExternalNodeOptions) {
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
