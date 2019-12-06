import dotenvExpand from 'dotenv-expand';
import fs from 'fs-extra';
import path from 'path';
import DependencyManager, { DatastoreNode, ServiceNode } from '../../dependency-manager/src';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DockerComposeTemplate from './template';

export const generate = (dependency_manager: DependencyManager): DockerComposeTemplate => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  const env_params_to_expand: { [key: string]: string } = {};

  // Enrich base service details
  dependency_manager.graph.nodes.forEach(node => {

    if (!(node instanceof ExternalNode)) {
      compose.services[node.normalized_ref] = {
        ports: [`${node.ports.expose}:${node.ports.target}`],
        depends_on: [],
        environment: {
          HOST: node.normalized_ref,
          PORT: node.ports.target.toString(),
          ARCHITECT: JSON.stringify({
            [node.name]: {
              host: `${node.protocol}${node.normalized_ref}`,
              port: node.ports.target.toString(),
              datastores: {},
              subscriptions: {},
            },
          }),
          ARCHITECT_CURRENT_SERVICE: node.name,
          ...node.parameters,
        },
      };

      for (const [param_name, param_value] of Object.entries(compose.services[node.normalized_ref].environment || {})) {
        env_params_to_expand[`${node.normalized_ref.toUpperCase()}_${param_name}`.replace(/\./g, '_')] = param_value;
      }
      for (const [param_name, param_value] of Object.entries(node.service_config.getParameters())) {
        if ((node instanceof LocalServiceNode || node instanceof ServiceNode) && param_value.default instanceof Object && param_value.default ?.valueFrom) {
          const param_target_service_name = param_value.default.valueFrom.dependency;
          const param_target_datastore_name = param_value.default.valueFrom.datastore;
          if (param_target_service_name) {
            const param_target_service = dependency_manager.graph.nodes.get(param_target_service_name);
            if (!param_target_service) {
              throw new Error(`Service ${param_target_service_name} not found for config of ${node.name}`);
            }
            env_params_to_expand[`${node.normalized_ref.toUpperCase()}_${param_name}`.replace(/\./g, '_')] =
              param_value.default.valueFrom.value.replace(/\$/g, `$${param_target_service.normalized_ref.toUpperCase()}_`).replace(/\./g, '_');
          } else if (param_target_datastore_name) {
            const param_target_datastore = dependency_manager.graph.edges.filter(edge => edge.from.name === node.name && (edge.to as DatastoreNode).key === param_target_datastore_name);
            if (!param_target_datastore.length) {
              throw new Error(`Datastore ${param_target_datastore_name} not found for service ${node.name}`);
            }
            env_params_to_expand[`${param_target_datastore_name}.${node.normalized_ref}.${param_name}`.toUpperCase().replace(/\./g, '_')] =
              param_value.default.valueFrom.value.replace(/\$/g, `$${node.normalized_ref}.${param_target_datastore_name}_`.toUpperCase()).replace(/\./g, '_');
          }
        }
      }
    }

    if (node instanceof ServiceNode || node instanceof LocalServiceNode) {
      const current_environment = compose.services[node.normalized_ref].environment;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ARCHITECT = JSON.parse(current_environment!.ARCHITECT);
      ARCHITECT[node.name].api = node.api.type;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      compose.services[node.normalized_ref].environment!.ARCHITECT = JSON.stringify(ARCHITECT);
    }

    if (node instanceof LocalServiceNode) {
      // Setup build context
      compose.services[node.normalized_ref].build = {
        context: node.service_path,
        args: ['ARCHITECT_DEBUG=1'],
      };

      if (node.command) {
        compose.services[node.normalized_ref].command = node.command;
      }

      // Mount the src directory
      const src_path = path.join(node.service_path, 'src');
      if (fs.pathExistsSync(src_path)) {
        compose.services[node.normalized_ref].volumes = [`${src_path}:/usr/src/app/src`];
      }
    } else if (!(node instanceof ExternalNode)) {
      compose.services[node.normalized_ref].image = node.image;
    }
  });

  const expanded_params = dotenvExpand({ parsed: env_params_to_expand }).parsed;
  dependency_manager.graph.nodes.forEach(node => {
    const service_name = node.normalized_ref;
    const service_prefix = service_name.replace(/[^\w\s]/gi, '_').toUpperCase();
    const written_env_keys = [];

    // map datastore params
    const service_datastore_edges = dependency_manager.graph.edges.filter(edge => edge.from.normalized_ref === service_name && edge.to instanceof DatastoreNode);
    for (const edge of service_datastore_edges) {
      const datastore_prefix = `${(edge.to as DatastoreNode).key}_${service_prefix}`.toUpperCase();
      const service_datastore_params = Object.entries(expanded_params || {})
        .filter(([key, _]) => key.startsWith(datastore_prefix));
      for (const [param_name, param_value] of service_datastore_params) {
        const real_param_name = param_name.replace(`${datastore_prefix}_`, '');
        compose.services[service_name].environment![real_param_name] = param_value;
        written_env_keys.push(param_name.replace(`${datastore_prefix}_`, ''));
      }
    }

    // map service params
    const service_params = Object.entries(expanded_params || {})
      .filter(([key, _]) => key.startsWith(service_prefix));

    for (const [param_name, param_value] of service_params) {
      const real_param_name = param_name.replace(`${service_prefix}_`, '');
      if (!written_env_keys.find(key => key === real_param_name)) {
        compose.services[service_name].environment![real_param_name] = param_value;
      }
    }
  });

  // Enrich service relationships
  dependency_manager.graph.edges.forEach(edge => {
    // Parse the ARCHITECT param
    const service = compose.services[edge.from.normalized_ref];
    service.environment = service.environment || {};
    service.environment.ARCHITECT = service.environment.ARCHITECT ? JSON.parse(service.environment.ARCHITECT) : {};

    // Handle datastore credential enrichment to callers
    if (edge.to instanceof DatastoreNode) {
      service.environment.ARCHITECT[edge.from.name].datastores[edge.to.key] = {
        host: `${edge.to.protocol}${edge.to.normalized_ref}`,
        port: edge.to.ports.target.toString(),
        ...edge.to.parameters,
      };
    } else if (edge.to instanceof ExternalNode) {
      service.environment.ARCHITECT[edge.from.name].datastores[edge.to.key] = {
        host: edge.to.host,
        port: edge.to.ports.target.toString(),
        ...edge.to.parameters,
      };
    } else if (edge.to instanceof ServiceNode || edge.to instanceof LocalServiceNode) {
      service.environment.ARCHITECT[edge.to.name] = {
        host: `${edge.to.protocol}${edge.to.normalized_ref}`,
        port: edge.to.ports.target.toString(),
        api: edge.to.api.type,
      };
    }

    // Parse subscription logic
    if (edge.type === 'notification' && (edge.to instanceof ServiceNode || edge.to instanceof LocalServiceNode)) {
      const to = edge.to as ServiceNode;
      const to_subscriptions = to.service_config.getSubscriptions();
      service.environment.ARCHITECT[edge.from.name].subscriptions =
        Object.keys(to_subscriptions).reduce((subscriptions, publisher_name) => {
          Object.keys(to_subscriptions[publisher_name]).forEach(event_name => {
            subscriptions[event_name] = { [to.service_config.getName()]: to_subscriptions[publisher_name][event_name].data };
          });
          return subscriptions;
        }, service.environment.ARCHITECT[edge.from.name].subscriptions);
    } else if (!(edge.to instanceof ExternalNode)) {
      compose.services[edge.from.normalized_ref].depends_on.push(edge.to.normalized_ref);
    }

    // Re-encode the ARCHITECT param
    service.environment.ARCHITECT = JSON.stringify(service.environment.ARCHITECT || {});
    compose.services[edge.from.normalized_ref] = service;
  });

  return compose;
};
