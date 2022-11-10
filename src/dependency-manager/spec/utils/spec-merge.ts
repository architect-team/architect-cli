import { plainToClass } from 'class-transformer';
import deepmerge, { Options } from 'deepmerge';
import { Dictionary } from '../../utils/dictionary';
import { RecursivePartial } from '../../utils/types';
import { ComponentSpec, IngressSpec } from '../component-spec';

export function generateIngressesOverrideSpec(component_spec: ComponentSpec, ingresses: Dictionary<IngressSpec>): RecursivePartial<ComponentSpec> {
  return {};

  /* TODO:TJ
  const spec: RecursivePartial<ComponentSpec> = {};
  spec.interfaces = {};

  const interface_names = Object.keys(component_spec.interfaces || {});
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

    if (!spec.interfaces[interface_name]) {
      spec.interfaces[interface_name] = {};
    }
    spec.interfaces[interface_name] = {
      ingress,
    };
  }

  if (errors && errors.length > 0) {
    throw new ValidationErrors(errors);
  }

  return plainToClass(ComponentSpec, spec);
  */
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
