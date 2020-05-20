import Mustache from 'mustache';
import { ServiceNode } from '../..';
import DependencyGraph from '../../graph';
import { InterpolationContext } from '../../interpolation/interpolation-context';
import { ParameterValueV2 } from '../../service-config/base';
import { EnvironmentInterfaceContext, EnvironmentInterpolationContext, EnvironmentParameterMap, ServiceInterfaceContext } from './interpolation-context';


export class ParameterInterpolator {

  public static interpolateAllParameters(all_parameters: EnvironmentParameterMap, environment_context: EnvironmentInterpolationContext): EnvironmentParameterMap { //TODO:76:type environment_context

    // this illustrates the drawback with not using the structure of the graph to traverse this more efficiently
    let change_detected = true;
    let passes = 0;
    const MAX_DEPTH = 100; //TODO:76
    const interpolated_parameters: EnvironmentParameterMap = {};
    while (change_detected && passes < MAX_DEPTH) {

      change_detected = false;
      for (const [node_ref, parameters] of Object.entries(all_parameters)) {

        interpolated_parameters[node_ref] = {};
        for (const [param_key, param_value] of Object.entries(parameters)) {
          const interpolated_value = ParameterInterpolator.interpolateParamValue(param_value, environment_context);

          // check to see if the interpolated value is different from the one listed in the environment_context. if it is, we're
          // going to want to do another pass and set the updated value in the environment_context
          if (environment_context[node_ref].parameters[param_key] !== interpolated_value) {
            change_detected = true;
            environment_context[node_ref].parameters[param_key] = interpolated_value;
          }
          interpolated_parameters[node_ref][param_key] = interpolated_value;
        }
      }
      passes++;
    }

    if (passes >= MAX_DEPTH) {
      throw new Error('Stack Overflow Error'); //TODO:76: better message
    }

    return interpolated_parameters;
  }

  public static build_friendly_name_map(graph: DependencyGraph): { [key: string]: { [key: string]: string } } {
    const friendly_name_map: { [key: string]: { [key: string]: string } } = {};
    for (const node of graph.getServiceNodes()) {
      friendly_name_map[node.ref] = {};
      for (const friendly_name of Object.keys(node.node_config.getDependencies())) {
        const top_level_node = graph.getServiceNodes().find(n => n.node_config.getName() === friendly_name);

        if (top_level_node) {
          friendly_name_map[node.ref][friendly_name] = top_level_node.namespace_ref;
        }
      }
    }
    return friendly_name_map;
  }

  public static mapToParameterSet(graph: DependencyGraph, global_parameter_map: { [key: string]: string }): EnvironmentParameterMap {
    const friendly_name_map = ParameterInterpolator.build_friendly_name_map(graph);
    const parameter_set: EnvironmentParameterMap = {};
    for (const node of graph.nodes) {
      parameter_set[node.namespace_ref] = {};
      if (!(node instanceof ServiceNode)) {
        continue;
      }
      for (const [param_key, param_details] of Object.entries(node.node_config.getParameters())) {
        if (typeof param_details.default === 'object' && param_details.default !== null) {
          continue; //TODO:76: this can get ripped out when we remove ValueFrom support
        }

        const global_value = global_parameter_map[param_key];
        const upstream_value = undefined; // ParameterInterpolator.namespaceParameter(upstream_node.namespace_ref, upstream_node.dependencies[node.ref].parameters[param_key]); namespace it to the node that declared it!
        const param_default = ParameterInterpolator.namespaceParameter(node.namespace_ref, (param_details.default as ParameterValueV2), friendly_name_map[node.ref]);
        const param_value = ParameterInterpolator.mergeParam(upstream_value, global_value, param_default);

        if (ParameterInterpolator.isNullParamValue(param_value) && param_details.required) {
          throw new Error(`Required parameter doesn't have a value`);
        }

        parameter_set[node.namespace_ref][param_key] = param_value;
      }
    }

    return parameter_set;
  }

  public static mapToDataContext(graph: DependencyGraph, interface_context: EnvironmentInterfaceContext): EnvironmentInterpolationContext {
    const environment_context: EnvironmentInterpolationContext = {};

    for (const node of graph.getServiceNodes()) {
      const service_context = ParameterInterpolator.map(node, interface_context[node.ref]);
      environment_context[node.namespace_ref] = service_context;
    }

    return environment_context;
  }

  public static map(node: ServiceNode, interface_context: ServiceInterfaceContext): InterpolationContext {
    return {
      parameters: Object.entries(node.service_config.getParameters())
        .reduce((result: { [key: string]: any }, [k, v]) => {
          result[k] = v.default;
          return result;
        }, {}),
      interfaces: Object.keys(node.interfaces)
        .map(i => {
          return { key: i, value: interface_context[i] };
        })
        .reduce((result: { [key: string]: any }, { key, value }) => {
          result[key] = value;
          return result;
        }, {}),
    };
  }

  public static mergeParam(parent_value: ParameterValueV2, global_value: ParameterValueV2, default_value: ParameterValueV2): ParameterValueV2 {
    return !ParameterInterpolator.isNullParamValue(parent_value) ? parent_value
      : !ParameterInterpolator.isNullParamValue(global_value) ? global_value
        : !ParameterInterpolator.isNullParamValue(default_value) ? default_value
          : undefined;
  }

  public static isNullParamValue(param_value: ParameterValueV2) {
    return param_value === null || param_value === undefined;
  }

  public static namespaceParameter(node_ref: string, param_value: ParameterValueV2, friendly_name_map: { [key: string]: string }) {
    if (typeof param_value !== 'string') {
      return param_value;
    }
    if (!param_value.includes('${')) {
      return param_value;
    }

    let namespaced_value = param_value;

    const interfaces_search_string = /\$\{\s*interfaces/g;
    namespaced_value = namespaced_value.replace(interfaces_search_string, `$\{ ${node_ref}.interfaces`);

    const parameters_search_string = /\$\{\s*parameters/g;
    namespaced_value = namespaced_value.replace(parameters_search_string, `$\{ ${node_ref}.parameters`);

    return ParameterInterpolator.namespaceDependency(param_value, friendly_name_map);
  }

  public static namespaceDependency(param_value: string, friendly_name_map: { [key: string]: string }): string {

    const bracket_notation_matcher = /\$\{\s*dependencies\[(.*?)\]\./g;
    const dot_notation_matcher = /\$\{\s*dependencies\.(.*?)\./g;

    let namespaced_dependency = param_value;
    namespaced_dependency = namespaced_dependency.replace(bracket_notation_matcher, (m) => {
      const dep = ParameterInterpolator.extract_friendly_name_from_brackets(m);
      return '${ ' + friendly_name_map[dep] + '.';
    });

    namespaced_dependency = namespaced_dependency.replace(dot_notation_matcher, (m) => {
      const dep = ParameterInterpolator.extract_friendly_name_from_dot_notation(m);
      return '${ ' + friendly_name_map[dep] + '.';
    });

    return namespaced_dependency;
  }

  public static extract_friendly_name_from_brackets(dependency_substring: string) {
    const matches = dependency_substring.match(/dependencies\['([\s\S]*?)'\]/);
    if (matches && matches.length > 1) {
      return matches[1];
    } else {
      throw new Error('Bad format for parameter:' + dependency_substring);
    }
  }

  public static extract_friendly_name_from_dot_notation(dependency_substring: string) {
    const matches = dependency_substring.match(/dependencies\.([\s\S]*?)\./);
    if (matches && matches.length > 1) {
      return matches[1];
    } else {
      throw new Error('Bad format for parameter:' + dependency_substring);
    }
  }

  public static interpolateParamValue(param_value: ParameterValueV2, environment_context: EnvironmentInterpolationContext): ParameterValueV2 {
    if (typeof param_value !== 'string') {
      return param_value;
    }
    if (!param_value.includes('${')) {
      return param_value;
    }

    Mustache.tags = ['${', '}']; // sets custom delimiters
    Mustache.escape = function (text) { return text; } // turns off HTML escaping
    return Mustache.render(param_value, environment_context);
  }
}
