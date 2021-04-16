import { DependencyNode } from '.';

export default class InterfacesNode extends DependencyNode {
  __type = 'interfaces';

  ref!: string;
  slug!: string;

  constructor(ref: string, slug: string) {
    super();
    this.ref = ref;
    this.slug = slug;
  }

  get interfaces(): { [key: string]: any } {
    return {};
  }
}
