import { DependencyNode, DependencyNodeOptions } from '.';

interface ExternalNodeOptions {
  key: string;
}

export class ExternalNode extends DependencyNode {
  key: string;

  constructor(options: DependencyNodeOptions & ExternalNodeOptions) {
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
    return `${super.ref}.${this.key}`;
  }
}
