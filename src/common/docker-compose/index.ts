import fs from 'fs-extra';
import path from 'path';
import DependencyManager, { DatastoreNode, DependencyNode, ServiceNode } from '../../dependency-manager/src';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DockerComposeTemplate from './template';

const inject_params = (environment: { [key: string]: string | number }, data_node: DependencyNode) => {
  let node_ref;
  if (data_node instanceof DatastoreNode) {
    node_ref = data_node.parent_ref;
  } else {
    node_ref = data_node.ref;
  }
  const [service_name, service_tag] = node_ref.split(':');

  const param_prefix = `$ARC_${service_name.replace(/[^\w\s]/gi, '_').toUpperCase()}_${service_tag.replace(/[^\w\s]/gi, '_').toUpperCase()}`;
  const host_param_placeholder = `${param_prefix}_HOST`;
  const port_param_placeholder = `${param_prefix}_PORT`;
  const injected_params: { [key: string]: string | number } = {};
  for (const [name, value] of Object.entries(environment)) {
    let newValue = value;
    if (newValue.toString().indexOf(host_param_placeholder) > -1) {
      const regex = new RegExp(`\\${host_param_placeholder}`, 'g');
      newValue = newValue.toString().replace(regex, `${data_node.protocol}${data_node.normalized_ref}`);
    }
    if (newValue.toString().indexOf(port_param_placeholder) > -1) {
      const regex = new RegExp(`\\${port_param_placeholder}`, 'g');
      newValue = newValue.toString().replace(regex, data_node.ports.target.toString());
    }
    injected_params[name] = newValue;
  }
  return injected_params;
};

export const generate = (dependency_manager: DependencyManager): DockerComposeTemplate => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  // Enrich base service details
  for (const node of dependency_manager.graph.nodes) {
    if (!(node instanceof ExternalNode)) {
      compose.services[node.normalized_ref] = {
        ports: [`${node.ports.expose}:${node.ports.target}`],
        depends_on: [],
        environment: {
          HOST: node.normalized_ref,
          PORT: node.ports.target.toString(),
          ARCHITECT: JSON.stringify({
            [node.ref]: {
              host: `${node.protocol}${node.normalized_ref}`,
              port: node.ports.target.toString(),
              datastores: {},
              subscriptions: {},
            },
          }),
          ARCHITECT_CURRENT_SERVICE: node.ref,
          ...node.parameters,
        },
      };
    }

    if (node instanceof ServiceNode) {
      const current_environment = compose.services[node.normalized_ref].environment;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ARCHITECT = JSON.parse(current_environment!.ARCHITECT);
      ARCHITECT[node.ref].api = node.api.type;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      compose.services[node.normalized_ref].environment!.ARCHITECT = JSON.stringify(ARCHITECT);
      compose.services[node.normalized_ref].environment = Object.assign({}, current_environment, inject_params(current_environment || {}, node));
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
    } else if (node instanceof ServiceNode || node instanceof DatastoreNode) {
      compose.services[node.normalized_ref].image = node.image;
    }
  }

  // Enrich service relationships
  for (const edge of dependency_manager.graph.edges) {
    const node_from = dependency_manager.graph.getNodeByRef(edge.from);
    const node_to = dependency_manager.graph.getNodeByRef(edge.to);

    // Parse the ARCHITECT param
    const service = compose.services[node_from.normalized_ref];
    service.environment = service.environment || {};
    service.environment.ARCHITECT = service.environment.ARCHITECT ? JSON.parse(service.environment.ARCHITECT) : {};

    // Handle datastore credential enrichment to callers
    if (node_to instanceof DatastoreNode) {
      service.environment.ARCHITECT[node_from.ref].datastores[node_to.key] = {
        host: `${node_to.protocol}${node_to.normalized_ref}`,
        port: node_to.ports.target.toString(),
        ...node_to.parameters,
      };
      service.environment = Object.assign({}, service.environment, inject_params(service.environment, node_to));
    } else if (node_to instanceof ExternalNode) {
      service.environment.ARCHITECT[node_from.ref].datastores[node_to.key] = {
        host: node_to.host,
        port: node_to.ports.target.toString(),
        ...node_to.parameters,
      };
    } else if (node_to instanceof ServiceNode) {
      service.environment.ARCHITECT[node_to.ref] = {
        host: `${node_to.protocol}${node_to.normalized_ref}`,
        port: node_to.ports.target.toString(),
        api: node_to.api.type,
      };
      service.environment = Object.assign({}, service.environment, inject_params(service.environment, node_to));
    }

    // Parse subscription logic
    if (edge.type === 'notification' && node_to instanceof ServiceNode) {
      const to = node_to as ServiceNode;
      const to_subscriptions = to.service_config.getSubscriptions();
      service.environment.ARCHITECT[node_from.ref].subscriptions =
        Object.keys(to_subscriptions).reduce((subscriptions, publisher_name) => {
          Object.keys(to_subscriptions[publisher_name]).forEach(event_name => {
            subscriptions[event_name] = { [to.service_config.getName()]: to_subscriptions[publisher_name][event_name].data };
          });
          return subscriptions;
        }, service.environment.ARCHITECT[node_from.ref].subscriptions);
    } else if (!(node_to instanceof ExternalNode)) {
      compose.services[node_from.normalized_ref].depends_on.push(node_to.normalized_ref);
    }

    // Re-encode the ARCHITECT param
    service.environment.ARCHITECT = JSON.stringify(service.environment.ARCHITECT || {});
    compose.services[node_from.normalized_ref] = service;
  }

  return compose;
};
