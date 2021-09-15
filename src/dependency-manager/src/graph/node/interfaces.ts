import { DependencyNode } from '.';
import { ComponentInterfaceConfig, ServiceInterfaceConfig } from '../..';
import { Dictionary } from '../../utils/dictionary';

export default class InterfacesNode extends DependencyNode {
  __type = 'interfaces';

  ref!: string;
  slug!: string;
  config!: Dictionary<ComponentInterfaceConfig>;

  constructor(ref: string, slug: string, config: Dictionary<ComponentInterfaceConfig>) {
    super();
    this.ref = ref;
    this.slug = slug;
    this.config = config;
  }

  get interfaces(): Dictionary<ServiceInterfaceConfig> {
    return {};
  }

  get component_interfaces(): Dictionary<ComponentInterfaceConfig> {
    return this.config;
  }
}
