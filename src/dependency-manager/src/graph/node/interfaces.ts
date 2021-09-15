import { DependencyNode } from '.';
import { ComponentInterfaceConfig } from '../../config/component-config';
import { Dictionary } from '../../utils/dictionary';

export default class InterfacesNode extends DependencyNode {
  __type = 'interfaces';

  ref: string;
  slug: string;
  config: Dictionary<ComponentInterfaceConfig>;

  constructor(ref: string, slug: string, config: Dictionary<ComponentInterfaceConfig>) {
    super();
    this.ref = ref;
    this.slug = slug;
    this.config = config;
  }

  get interfaces(): { [key: string]: any } {
    return {};
  }
}
