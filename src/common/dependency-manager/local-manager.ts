import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import deepmerge from 'deepmerge';
import yaml from 'js-yaml';
import DependencyManager, { ArchitectContext, buildSpecFromYml, ComponentInstanceMetadata, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils, IngressSpec } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import { buildSpecFromPath } from '../../dependency-manager/src/spec/utils/component-builder';
import { IF_EXPRESSION_REGEX } from '../../dependency-manager/src/spec/utils/interpolation';
import { generateIngressesOverrideSpec, overrideSpec } from '../../dependency-manager/src/spec/utils/spec-merge';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import PortUtil from '../utils/port';

interface ComponentConfigOpts {
  map_all_interfaces: boolean;
}

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;
  use_sidecar = false;
  environment = 'local';
  now = new Date();

  constructor(api: AxiosInstance, linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.linked_components = linked_components;
  }

  async loadComponentSpec(component_string: string, interfaces?: Dictionary<string>, options?: ComponentConfigOpts): Promise<ComponentSpec> {
    const merged_options = {
      ...{
        map_all_interfaces: false,
      }, ...options,
    };

    const { component_account_name, component_name, tag, instance_name } = ComponentVersionSlugUtils.parse(component_string);
    const component_slug = ComponentSlugUtils.build(component_account_name, component_name);
    const component_ref = ComponentVersionSlugUtils.build(component_account_name, component_name, tag, instance_name);

    let spec: ComponentSpec;
    const metadata: ComponentInstanceMetadata = {
      ref: component_ref,
      tag: tag,
      instance_name,
      instance_id: component_ref,
      instance_date: this.now,
      proxy_port_mapping: {},
    };
    // Load locally linked component config
    if (component_slug in this.linked_components) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Using locally linked ${chalk.blue(component_slug)} found at ${chalk.blue(this.linked_components[component_slug])}`);
      }
      const component_spec = buildSpecFromPath(this.linked_components[component_slug]);
      spec = component_spec;
    } else {
      // Load remote component config
      const { data: component_version } = await this.api.get(`/accounts/${component_account_name}/components/${component_name}/versions/${tag}`).catch((err) => {
        err.message = `Could not download component for ${component_ref}\n${err.message}`;
        throw err;
      });

      const config_yaml = yaml.dump(component_version.config);
      spec = buildSpecFromYml(config_yaml);
    }

    spec.metadata = {
      ...spec.metadata,
      ...metadata,
    };

    const ingresses: Dictionary<IngressSpec> = {};
    if (merged_options.map_all_interfaces) {
      for (const interface_name of Object.keys(spec.interfaces || {})) {
        if (!IF_EXPRESSION_REGEX.test(interface_name)) {
          ingresses[interface_name] = {
            enabled: true,
          };
        }
      }
    }
    for (const [subdomain, interface_name] of Object.entries(interfaces || {})) {
      ingresses[interface_name] = {
        enabled: true,
        subdomain: subdomain,
      };
    }

    const interfaces_spec = generateIngressesOverrideSpec(spec, ingresses);
    spec = overrideSpec(spec, interfaces_spec);

    // Deprecated: Use if statements instead of debug block
    if (spec.metadata.file?.path && this.environment === 'local') {
      const overwriteMerge = (destinationArray: any[], sourceArray: any[], options: deepmerge.Options) => sourceArray;

      if (spec.services) {
        for (const [sk, sv] of Object.entries(spec.services)) {
          // If debug is enabled merge in debug options ex. debug.command -> command
          if (sv.debug) {
            spec.services[sk] = deepmerge(sv, sv.debug, { arrayMerge: overwriteMerge });
          }
        }
      }
      if (spec.tasks) {
        for (const [tk, tv] of Object.entries(spec.tasks)) {
          // If debug is enabled merge in debug options ex. debug.command -> command
          if (tv.debug) {
            spec.tasks[tk] = deepmerge(tv, tv.debug, { arrayMerge: overwriteMerge });
          }
        }
      }
    }

    return spec;
  }

  async loadComponentSpecs(initial_component: ComponentSpec): Promise<ComponentSpec[]> {
    const component_specs = [];
    const component_specs_queue = [initial_component];
    const loaded_components = new Set();
    while (component_specs_queue.length) {
      const component_spec = component_specs_queue.pop();
      if (!component_spec) { break; }
      const ref = component_spec.metadata.ref;
      if (loaded_components.has(ref)) {
        continue;
      }
      loaded_components.add(ref);
      component_specs.push(component_spec);

      for (const [dep_name, dep_tag] of Object.entries(component_spec.dependencies || {})) {
        const dep_component_spec = await this.loadComponentSpec(`${dep_name}:${dep_tag}`);
        component_specs_queue.push(dep_component_spec);
      }
    }
    return component_specs;
  }

  getArchitectContext(): ArchitectContext {
    return {
      environment: this.environment,
    };
  }

  async getGraph(component_specs: ComponentSpec[], values: Dictionary<Dictionary<string | null>> = {}, interpolate = true, validate = true): Promise<DependencyGraph> {
    const gateway_port = await PortUtil.getAvailablePort(80);
    const external_addr = `arc.localhost:${gateway_port}`;
    return super.getGraph(component_specs, values, interpolate, validate, external_addr);
  }
}
