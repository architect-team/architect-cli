import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import DependencyManager, { ComponentVersionSlugUtils, DependencyNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import DependencyEdge from '../../dependency-manager/src/graph/edge';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import InterfacesNode from '../../dependency-manager/src/graph/node/interfaces';
import { ComponentConfigBuilder } from '../../dependency-manager/src/spec/component/component-builder';
import { ComponentConfig } from '../../dependency-manager/src/spec/component/component-config';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../../dependency-manager/src/utils/errors';
import PortUtil from '../utils/port';

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;

  constructor(api: AxiosInstance, linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.linked_components = linked_components;
  }

  async interpolateComponent2(component_config: ComponentConfig, component_map: Dictionary<ComponentConfig>, external_address: string, _interpolated_component_map: Dictionary<Promise<ComponentConfig>> = {}) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore catch circular loop
    _interpolated_component_map[component_config.getRef()] = async () => { throw new Error('TODO:207'); };

    const dependency_promises = [];
    for (const [dep_name, dep_tag] of Object.entries(component_config.getDependencies())) {
      const dep_ref = `${dep_name}:${dep_tag}`;
      if (!component_map[dep_ref]) {
        // TODO:207 talk to David about what should happen in the non-recursive case
        component_map[dep_ref] = await this.loadComponentConfig(dep_ref);
      }
      const dep_component = component_map[dep_ref];
      if (!_interpolated_component_map[dep_component.getRef()]) {
        _interpolated_component_map[dep_component.getRef()] = this.interpolateComponent2(dep_component, component_map, external_address, _interpolated_component_map);
      }
      dependency_promises.push(_interpolated_component_map[dep_component.getRef()]);
    }
    const dependencies = await Promise.all(dependency_promises);

    // TODO:207 set instance_id on component_config
    const { interpolated_component_config } = this.interpolateComponent(component_config, '', external_address, dependencies);

    return interpolated_component_config;
  }

  async getGraph(component_configs: ComponentConfig[], values?: Dictionary<Dictionary<string>>) {
    const graph = new DependencyGraph();

    const gateway_port = await PortUtil.getAvailablePort(80);

    const component_map: Dictionary<ComponentConfig> = {};
    for (const component_config of component_configs) {
      if (values) {
        // Set parameters from secrets
        this.setValuesForComponent(component_config, values);
      }
      component_map[component_config.getRef()] = component_config;
    }

    // Add nodes
    for (const component_config of component_configs) {
      const instance_id = '';
      let nodes: DependencyNode[] = [];

      // Interpolate the component before generating then nodes to support dynamic host overrides
      // const interpolated_component_config = await this.interpolateComponent(component_config, component_interfaces, instance_id, 'localhost', gateway_port);
      const interpolated_component_config = await this.interpolateComponent2(component_config, component_map, `localhost:${gateway_port}`);
      nodes = nodes.concat(this.getComponentNodes(interpolated_component_config, instance_id));

      if (Object.keys(component_config.getInterfaces()).length) {
        const node = new InterfacesNode(component_config.getInterfacesRef());
        nodes.push(node);
      }

      const component_interfaces: Dictionary<string> = {};
      for (const [interface_name, interface_obj] of Object.entries(component_config.getInterfaces())) {
        if (interface_obj.external_name) {
          component_interfaces[interface_obj.external_name] = interface_name;
        }
      }

      if (Object.keys(component_interfaces).length) {
        nodes.push(new GatewayNode(gateway_port));
      }

      for (const node of nodes) {
        graph.addNode(node);
      }
    }

    const gateway_node = graph.nodes.find((node) => node instanceof GatewayNode);

    // Add edges
    for (const component_config of component_configs) {
      const instance_id = '';
      let edges: DependencyEdge[] = [];
      const ignore_keys = ['']; // Ignore all errors
      const interpolated_component_config = this.interpolateInterfaces(component_config, ignore_keys);
      edges = edges.concat(this.getComponentEdges(graph, interpolated_component_config, instance_id));

      const component_interfaces: Dictionary<string> = {};
      for (const [interface_name, interface_obj] of Object.entries(component_config.getInterfaces())) {
        if (interface_obj.external_name) {
          component_interfaces[interface_obj.external_name] = interface_name;
        }
      }

      if (gateway_node && Object.keys(component_interfaces).length) {
        const ingress_edge = new IngressEdge(gateway_node.ref, component_config.getInterfacesRef(), component_interfaces);
        edges.push(ingress_edge);
      }

      for (const edge of edges) {
        graph.addEdge(edge);
      }
    }

    return graph;
  }

  async loadComponentConfig(component_string: string, interfaces?: Dictionary<string>): Promise<ComponentConfig> {
    const { component_account_name, component_name, tag } = ComponentVersionSlugUtils.parse(component_string);
    const component_slug = `${component_account_name}/${component_name}`;
    const component_ref = `${component_slug}:${tag}`;

    let config: ComponentConfig;
    // Load locally linked component config
    if (component_slug in this.linked_components) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Using locally linked ${chalk.blue(component_slug)} found at ${chalk.blue(this.linked_components[component_slug])}`);
      }
      config = await ComponentConfigBuilder.buildFromPath(this.linked_components[component_slug]);
      config.setExtends(`file:${this.linked_components[component_slug]}`);
    } else {
      // Load remote component config
      const { data: component_version } = await this.api.get(`/accounts/${component_account_name}/components/${component_name}/versions/${tag}`).catch((err) => {
        err.message = `Could not download component for ${component_ref}\n${err.message}`;
        throw err;
      });
      config = ComponentConfigBuilder.buildFromJSON(component_version.config);
    }

    // Set the tag
    config.setName(component_ref);

    for (const [interface_from, interface_to] of Object.entries(interfaces || {})) {
      const interface_obj = config.getInterfaces()[interface_to];
      if (!interface_obj) { continue; } // TODO:207 validation?
      interface_obj.external_name = interface_from;
      config.setInterface(interface_to, interface_obj);
    }

    // Set debug values
    for (const [sk, sv] of Object.entries(config.getServices())) {
      // If debug is enabled merge in debug options ex. debug.command -> command
      const debug_options = sv.getDebugOptions();
      if (debug_options) {
        config.setService(sk, sv.merge(debug_options));
      }
    }
    for (const [tk, tv] of Object.entries(config.getTasks())) {
      // If debug is enabled merge in debug options ex. debug.command -> command
      const debug_options = tv.getDebugOptions();
      if (debug_options) {
        config.setTask(tk, tv.merge(debug_options));
      }
    }

    return config;
  }

  async loadComponentConfigs(initial_component: ComponentConfig) {
    const component_configs = [];
    const component_configs_queue = [initial_component];
    const loaded_components = new Set();
    while (component_configs_queue.length) {
      const component_config = component_configs_queue.pop();
      if (!component_config) { break; }
      if (loaded_components.has(component_config.getRef())) {
        continue;
      }
      loaded_components.add(component_config.getRef());
      component_configs.push(component_config);

      for (const [dep_name, dep_tag] of Object.entries(component_config.getDependencies())) {
        const dep_component_config = await this.loadComponentConfig(`${dep_name}:${dep_tag}`);
        component_configs_queue.push(dep_component_config);
      }
    }
    return component_configs;
  }

  validateComponent(component: ComponentConfig, context: object, ignore_keys: string[]) {
    const errors = super.validateComponent(component, context, ignore_keys);
    const component_extends = component.getExtends();
    if (component_extends?.startsWith('file:') && errors.length) {
      const component_path = component_extends.substr('file:'.length);
      const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(component_path);
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return errors;
  }
}
