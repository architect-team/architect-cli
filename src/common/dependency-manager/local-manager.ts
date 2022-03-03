import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import deepmerge from 'deepmerge';
import yaml from 'js-yaml';
import DependencyManager, { ArchitectContext, ArchitectError, buildSpecFromYml, ComponentInstanceMetadata, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils, IngressSpec } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import { buildSpecFromPath } from '../../dependency-manager/src/spec/utils/component-builder';
import { IF_EXPRESSION_REGEX } from '../../dependency-manager/src/spec/utils/interpolation';
import { generateIngressesOverrideSpec, overrideSpec } from '../../dependency-manager/src/spec/utils/spec-merge';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import PortUtil from '../utils/port';

export interface ComponentConfigOpts {
  interfaces?: Dictionary<string>;
  map_all_interfaces?: boolean;
  instance_id?: string;
}

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;
  use_sidecar = false;
  environment = 'local';
  now = new Date();

  loaded_components: Dictionary<ComponentSpec> = {};

  constructor(api: AxiosInstance, linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.linked_components = linked_components;
  }

  async loadComponentSpec(component_string: string, options?: ComponentConfigOpts): Promise<ComponentSpec> {
    const merged_options = {
      ...{
        map_all_interfaces: false,
      }, ...options,
    };

    const { component_account_name, component_name, tag, instance_name } = ComponentVersionSlugUtils.parse(component_string);
    const component_ref = this.getComponentRef(component_string);

    if (this.loaded_components[component_ref]) {
      return this.loaded_components[component_ref];
    }

    let spec: ComponentSpec;
    const metadata: ComponentInstanceMetadata = {
      ref: component_ref,
      tag: tag,
      instance_name,
      instance_id: options?.instance_id || component_ref,
      instance_date: this.now,
    };

    if (this.use_sidecar) {
      metadata.proxy_port_mapping = {};
    }

    const account_name = component_account_name || this.account;
    const linked_component_key = component_ref in this.linked_components ? component_ref : ComponentSlugUtils.build(account_name, component_name);
    const linked_component = this.linked_components[linked_component_key];
    if (!linked_component && !account_name) {
      throw new ArchitectError(`Didn't find link for component '${component_ref}'.\nPlease run 'architect link' or specify an account via '--account <account>'.`);
    }

    // Load locally linked component config
    if (linked_component) {
      if (process.env.TEST !== '1') {
        console.log(`Using locally linked ${chalk.blue(linked_component_key)} found at ${chalk.blue(linked_component)}`);
      }
      const component_spec = buildSpecFromPath(linked_component, metadata);
      spec = component_spec;
    } else {
      console.log(`Didn't find link for component '${component_ref}'. Attempting to download from Architect...`);
      // Load remote component config
      const { data: component_version } = await this.api.get(`/accounts/${account_name}/components/${component_name}/versions/${tag}`).catch((err) => {
        err.message = `Could not download component for ${component_ref}. \n${err.message}`;
        throw err;
      });
      console.log(`Downloaded ${component_ref} from Architect.`);

      const config_yaml = yaml.dump(component_version.config);
      spec = buildSpecFromYml(config_yaml, metadata);
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
    for (const [subdomain, interface_name] of Object.entries(options?.interfaces || {})) {
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

    this.loaded_components[component_ref] = spec;

    return spec;
  }

  async loadComponentSpecs(root_component_ref: string): Promise<ComponentSpec[]> {
    const component_specs = [];

    const seen_component_refs = new Set();

    const component_refs_queue = [root_component_ref];

    while (component_refs_queue.length) {
      const component_ref = component_refs_queue.pop() as string;

      if (seen_component_refs.has(component_ref)) {
        continue;
      }
      seen_component_refs.add(component_ref);

      const component_spec = await this.loadComponentSpec(component_ref);
      component_specs.push(component_spec);

      for (const [dep_name, dep_tag] of Object.entries(component_spec.dependencies || {})) {
        component_refs_queue.push(`${dep_name}:${dep_tag}`);
      }
    }
    return component_specs;
  }

  getArchitectContext(): ArchitectContext {
    return {
      environment: this.environment,
    };
  }

  async getGraph(component_specs: ComponentSpec[], values: Dictionary<Dictionary<string | number | null>> = {}, interpolate = true, validate = true): Promise<DependencyGraph> {
    const gateway_port = await PortUtil.getAvailablePort(80);
    const external_addr = `arc.localhost:${gateway_port}`;
    return super.getGraph(component_specs, values, interpolate, validate, external_addr);
  }
}
