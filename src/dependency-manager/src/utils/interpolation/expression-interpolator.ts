import Mustache from 'mustache';
import { ServiceNode } from '../..';
import DependencyGraph from '../../graph';
import { ParameterValueV2 } from '../../service-config/base';
import { EnvironmentInterfaceContext, EnvironmentInterpolationContext, InterpolationContext, ServiceInterfaceContext } from './interpolation-context';

export class ExpressionInterpolator {

  /**
   * Keys available for top level use in expressions excludes `dependencies` which is handled as a unique case.
   *
   * ie ${ interfaces.X }  or ${ parameters.Y }
   */
  public static TOP_LEVEL_EXPRESSION_KEYS = [
    'interfaces',
    'parameters',
    // do not include 'dependencies'
  ];

  public static interpolateString(param_value: string, environment_context: EnvironmentInterpolationContext): string {
    Mustache.tags = ['${', '}']; // sets custom delimiters
    Mustache.escape = function (text) { return text; }; // turns off HTML escaping
    //TODO:77: add validation logic to catch expressions that don't refer to an existing path
    return Mustache.render(param_value, environment_context);
  }

  public static build_friendly_name_map(graph: DependencyGraph): { [key: string]: { [key: string]: string } } {
    const friendly_name_map: { [key: string]: { [key: string]: string } } = {};
    for (const node of graph.nodes) {
      if (node instanceof ServiceNode) {
        friendly_name_map[node.ref] = {};
        for (const friendly_name of Object.keys(node.node_config.getDependencies())) {
          const top_level_node = graph.nodes
            .filter(n => n instanceof ServiceNode)
            .map(n => n as ServiceNode)
            .find(n => n.node_config.getName() === friendly_name);

          if (top_level_node) {
            friendly_name_map[node.ref][friendly_name] = top_level_node.namespace_ref;
          }
        }
      }
    }
    return friendly_name_map;
  }

  public static mapGraphToInterpolationContext(graph: DependencyGraph, interface_context: EnvironmentInterfaceContext): EnvironmentInterpolationContext {
    const environment_context: EnvironmentInterpolationContext = {};

    for (const node of graph.nodes.filter(n => n instanceof ServiceNode).map(n => n as ServiceNode)) {
      const service_context = ExpressionInterpolator.mapNodeToInterpolationContext(node, interface_context[node.ref]);
      environment_context[node.namespace_ref] = service_context;
    }

    return environment_context;
  }

  public static mapNodeToInterpolationContext(node: ServiceNode, interface_context: ServiceInterfaceContext): InterpolationContext {
    return {
      parameters: Object.entries(node.node_config.getParameters())
        .reduce((result: { [key: string]: any }, [k, v]) => {
          result[k] = v.default;
          return result;
        }, {}),
      interfaces: Object.keys(node.interfaces)
        .map(interface_name => {
          return { key: interface_name, value: interface_context[interface_name] };
        })
        .reduce((result: { [key: string]: any }, { key, value }) => {
          result[key] = value;
          return result;
        }, {}),
    };
  }

  public static isNullParamValue(param_value: ParameterValueV2) {
    return param_value === null || param_value === undefined;
  }

  public static namespaceExpressions(node_ref: string, expression_string: string, friendly_name_map: { [key: string]: string }) {
    if (typeof expression_string !== 'string') {
      return expression_string;
    }
    if (!expression_string.includes('${')) {
      return expression_string;
    }

    let namespaced_value = expression_string;

    for (const key of ExpressionInterpolator.TOP_LEVEL_EXPRESSION_KEYS) {
      const search_string = new RegExp('\\$\\{\\s*' + key, 'g');
      namespaced_value = namespaced_value.replace(search_string, `$\{ ${node_ref}.${key}`);
    }

    const bracket_notation_matcher = /\$\{\s*dependencies\['([\s\S]*?)'\]\./g;
    const dot_notation_matcher = /\$\{\s*dependencies\.([\s\S]*?)\./g;

    namespaced_value = namespaced_value.replace(bracket_notation_matcher, (_, match) => {
      return '${ ' + friendly_name_map[match] + '.';
    });

    namespaced_value = namespaced_value.replace(dot_notation_matcher, (_, match) => {
      return '${ ' + friendly_name_map[match] + '.';
    });

    return namespaced_value;
  }
}
