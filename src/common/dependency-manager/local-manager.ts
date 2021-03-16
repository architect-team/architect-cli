import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import DependencyManager, { ComponentVersionSlugUtils, DependencyNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import DependencyEdge from '../../dependency-manager/src/graph/edge';
import InterfacesNode from '../../dependency-manager/src/graph/node/interfaces';
import { ComponentConfigBuilder } from '../../dependency-manager/src/spec/component/component-builder';
import { ComponentConfig } from '../../dependency-manager/src/spec/component/component-config';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import PortUtil from '../utils/port';

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;

  constructor(api: AxiosInstance, linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.linked_components = linked_components; // TODO:207
  }

  async getGraph(component_configs: ComponentConfig[], interfaces?: Dictionary<string>, values?: Dictionary<Dictionary<string>>) {
    const graph = new DependencyGraph();

    // Add nodes
    for (const component_config of component_configs) {
      const instance_id = 'TODO:207';
      let nodes: DependencyNode[] = [];
      if (values) {
        // Set parameters from secrets
        DependencyManager.setValuesForComponent(component_config, values);
      }

      // Interpolate the component before generating then nodes to support dynamic host overrides
      const { interpolated_component_config } = DependencyManager.interpolateComponent(component_config, instance_id, 'localhost');
      nodes = nodes.concat(DependencyManager.getComponentNodes(interpolated_component_config, instance_id));

      //nodes.push(new GatewayNode());

      const node = new InterfacesNode(component_config.getInterfacesRef());
      nodes.push(node);

      for (const node of nodes) {
        graph.addNode(node);
      }
    }

    // Add edges
    for (const component_config of component_configs) {
      const instance_id = 'TODO:207';
      let edges: DependencyEdge[] = [];
      const ignore_keys = ['']; // Ignore all errors
      const interpolated_component_config = DependencyManager.interpolateInterfaces(component_config, ignore_keys);
      edges = edges.concat(DependencyManager.getComponentEdges(graph, interpolated_component_config, instance_id));

      /* TODO:207
      if (gateway_node) {
        const ingress_edge = new IngressEdge(gateway_node.ref, component_config.getInterfacesRef(), deployment.metadata.interfaces);
        edges.push(ingress_edge);
      }
      */

      for (const edge of edges) {
        graph.addEdge(edge);
      }
    }

    return graph;
  }

  /**
   * @override
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return PortUtil.getAvailablePort(starting_port);
  }

  async loadComponentConfig(component_string: string): Promise<ComponentConfig> {
    const { component_account_name, component_name, tag } = ComponentVersionSlugUtils.parse(component_string);
    const component_slug = `${component_account_name}/${component_name}`;
    const component_ref = `${component_slug}:${tag}`;

    let config: ComponentConfig;
    // Load locally linked component config
    if (component_slug in this.linked_components) {
      console.log(`Using locally linked ${chalk.blue(component_slug)} found at ${chalk.blue(this.linked_components[component_slug])}`);
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

    return config;
  }

  /*
  async loadComponentConfigWrapper(initial_config: ComponentConfig) {
    const component_config = await super.loadComponentConfigWrapper(initial_config);
    let component_path = component_config.getLocalPath();
    if (component_path) {
      component_path = fs.lstatSync(component_path).isFile() ? path.dirname(component_path) : component_path;
    }
    return component_config;
  }
  */

  /* TODO:207
  // Ignore architect context for local
  validateComponent(component: ComponentConfig, context: object, ignore_keys: string[] = ['architect.']) {
    const errors = super.validateComponent(component, context, ignore_keys);
    const component_extends = component.getExtends();
    if (component_extends?.startsWith('file:') && errors.length) {
      const component_path = component_extends.substr('file:'.length);
      const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(component_path);
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return errors;
  }
  */

  /*
  async loadComponents(graph: DependencyGraph) {
    const components_map = await super.loadComponents(graph);
    for (const component of Object.values(components_map)) {
      for (const [sk, sv] of Object.entries(component.getServices())) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        const debug_options = sv.getDebugOptions();
        if (debug_options) {
          component.setService(sk, sv.merge(debug_options));
        }
      }
      for (const [tk, tv] of Object.entries(component.getTasks())) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        const debug_options = tv.getDebugOptions();
        if (debug_options) {
          component.setTask(tk, tv.merge(debug_options));
        }
      }
    }
    return components_map;
  }
  */
}
