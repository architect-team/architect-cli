import { DependencyNode } from '.';
import { ComponentNodeConfig } from '../../config/component-config';
import { ServiceInterfaceConfig } from '../../config/service-config';
import { Dictionary } from '../../utils/dictionary';

export class ComponentNode extends DependencyNode {
  __type = 'interfaces';

  ref: string;
  slug: string;
  config: ComponentNodeConfig;

  constructor(ref: string, slug: string, config: ComponentNodeConfig) {
    super();
    this.ref = ref;
    this.slug = slug;
    this.config = config;
  }

  get interfaces(): Dictionary<ServiceInterfaceConfig> {
    return {};
  }
}
