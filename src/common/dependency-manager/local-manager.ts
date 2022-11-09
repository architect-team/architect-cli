import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import deepmerge from 'deepmerge';
import yaml from 'js-yaml';
import DependencyManager, { ArchitectContext, ArchitectError, buildSpecFromPath, buildSpecFromYml, ComponentInstanceMetadata, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils, Dictionary, generateIngressesOverrideSpec, IngressSpec, overrideSpec } from '../../';
import { IF_EXPRESSION_REGEX } from '../../dependency-manager/spec/utils/interpolation';

export interface ComponentConfigOpts {
  interfaces?: Dictionary<string>;
  map_all_interfaces?: boolean;
  instance_id?: string;
}

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;
  environment = 'local';
  now = new Date();

  loaded_components: Dictionary<ComponentSpec> = {};

  constructor(api: AxiosInstance, account?: string, linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.account = account;
    this.linked_components = linked_components;
  }

  async loadComponentSpec(component_string: string, options?: ComponentConfigOpts, debug?: boolean): Promise<ComponentSpec> {
    const merged_options = {

      map_all_interfaces: false,
      ...options,
    };

    const { component_name, tag, instance_name } = ComponentVersionSlugUtils.parse(component_string);
    const component_ref = this.getComponentRef(component_string);

    if (this.loaded_components[component_ref]) {
      return this.loaded_components[component_ref];
    }

    let spec: ComponentSpec;
    const metadata: ComponentInstanceMetadata = {
      ref: component_ref,
      architect_ref: component_ref,
      tag: tag,
      instance_name,
      instance_id: options?.instance_id || component_ref,
      instance_date: this.now,
    };

    const linked_component_key = component_ref in this.linked_components ? component_ref : ComponentSlugUtils.build(this.account, component_name);
    const linked_component = this.linked_components[linked_component_key];
    if (!linked_component && !this.account) {
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
      const { data: component_version } = await this.api.get(`/accounts/${this.account}/components/${component_name}/versions/${tag}`).catch((err) => {
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
            subdomain: interface_name,
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

    if (spec.metadata.file?.path && debug) {
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

  async loadComponentSpecs(root_component_ref: string, debug = false): Promise<ComponentSpec[]> {
    const component_specs = [];

    const seen_component_refs = new Set();

    const component_refs_queue = [root_component_ref];

    while (component_refs_queue.length > 0) {
      const component_ref = component_refs_queue.pop() as string;

      if (seen_component_refs.has(component_ref)) {
        continue;
      }
      seen_component_refs.add(component_ref);

      const component_spec = await this.loadComponentSpec(component_ref, undefined, debug);
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
}
