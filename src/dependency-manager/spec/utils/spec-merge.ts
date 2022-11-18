import { plainToClass } from 'class-transformer';
import deepmerge, { Options } from 'deepmerge';
import { Dictionary } from '../../utils/dictionary';
import { ValidationError, ValidationErrors } from '../../utils/errors';
import { findPotentialMatch } from '../../utils/match';
import { RecursivePartial } from '../../utils/types';
import { ComponentSpec } from '../component-spec';
import { IngressSpec } from '../service-spec';

export function generateIngressesOverrideSpec(component_spec: ComponentSpec, ingresses: Dictionary<IngressSpec>): RecursivePartial<ComponentSpec> {
  const spec: RecursivePartial<ComponentSpec> = {};
  spec.services = {};

  const interface_names = Object.keys(component_spec.metadata.deprecated_interfaces_map || {});
  const errors = [];
  for (const [interface_name, ingress] of Object.entries(ingresses)) {
    if (!interface_names.includes(interface_name)) {
      const error = new ValidationError({
        component: component_spec.name,
        path: `interfaces.${interface_name}`,
        message: `Invalid key: ${interface_name}`,
        value: { ingress },
      });
      if (interface_names.length > 0) {
        const potential_match = findPotentialMatch(`interfaces.${interface_name}`, interface_names.map(i => `interfaces.${i}`));
        if (potential_match) {
          error.message += ` - Did you mean \${{ ${potential_match} }}?`;
        }
        error.message += `\nValid interfaces are (${interface_names.join(', ')})`;
      } else {
        error.message += `\nThis component does not define any interfaces.`;
      }
      errors.push(error);
    }

    const service_name = component_spec.metadata.deprecated_interfaces_map[interface_name];
    if (!service_name) continue;

    if (!spec.services[service_name]) {
      spec.services[service_name] = {};
    }
    const service = spec.services[service_name]!;
    if (!service.interfaces) {
      service.interfaces = {};
    }
    if (!service.interfaces[interface_name]) {
      service.interfaces[interface_name] = {};
    }
    service.interfaces[interface_name] = {
      ingress,
    };
  }

  if (errors && errors.length > 0) {
    throw new ValidationErrors(errors);
  }

  return plainToClass(ComponentSpec, spec);
}

const overwriteMerge = (destinationArray: any[], sourceArray: any[], options: deepmerge.Options) => sourceArray;

function specMerge(key: string, options?: Options): ((x: any, y: any) => any) | undefined {
  return (x, y) => {
    if (!(x instanceof Object) && y instanceof Object && y.constructor?.merge_key) {
      return { [y.constructor.merge_key]: x, ...y };
    } else if (x instanceof Object && !(y instanceof Object) && x.constructor?.merge_key) {
      return { ...x, [x.constructor.merge_key]: y };
    } else {
      return deepmerge(x, y, { arrayMerge: overwriteMerge, customMerge: specMerge });
    }
  };
}

export function overrideSpec(spec: ComponentSpec, override: RecursivePartial<ComponentSpec>): ComponentSpec {
  return plainToClass(ComponentSpec, deepmerge(spec, override, { arrayMerge: overwriteMerge, customMerge: specMerge }));
}
