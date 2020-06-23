import { DependencyNode } from '.';

export default class InterfacesNode extends DependencyNode {
  __type = 'interfaces';

  ref!: string;

  constructor(ref: string) {
    super();
    this.ref = ref;
  }

  get interfaces(): { [key: string]: any } {
    return {};
  }
}
