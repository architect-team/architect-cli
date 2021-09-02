import { DependencyNode } from '.';
import { ComponentInterfaceConfig } from '../../config/component-config';
import { ServiceInterfaceConfig } from '../../config/service-config';
import { Dictionary } from '../../utils/dictionary';

export default class InterfacesNode extends DependencyNode {
  __type = 'interfaces';

  ref!: string;
  slug!: string;
  component_interfaces!: Dictionary<ComponentInterfaceConfig>;

  constructor(ref: string, slug: string, component_interfaces: Dictionary<ComponentInterfaceConfig>) {
    super();
    this.ref = ref;
    this.slug = slug;
    this.component_interfaces = component_interfaces;
  }

  get interfaces(): { [key: string]: ServiceInterfaceConfig } {
    return {};
  }
}
