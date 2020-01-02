import fs from 'fs-extra';
import path from 'path';
import DependencyManager, { DatastoreNode, ServiceNode } from '../../dependency-manager/src';
import NotificationEdge from '../../dependency-manager/src/graph/edge/notification';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DockerComposeTemplate from './template';

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
            [node.env_ref]: {
              host: `${node.protocol}${node.normalized_ref}`,
              port: node.ports.target.toString(),
              datastores: {},
              subscriptions: {},
            },
          }),
          ARCHITECT_CURRENT_SERVICE: node.env_ref,
          ...node.parameters,
        },
      };
    }

    if (node instanceof ServiceNode) {
      const current_environment = compose.services[node.normalized_ref].environment;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ARCHITECT = JSON.parse(current_environment!.ARCHITECT);
      ARCHITECT[node.env_ref].api = node.api.type;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      compose.services[node.normalized_ref].environment!.ARCHITECT = JSON.stringify(ARCHITECT);
    }

    if (node instanceof LocalServiceNode) {
      const build_parameter_keys = Object.entries(node.service_config.getParameters()).filter(([_, value]) => (value && value.build_arg)).map(([key, _]) => key);
      const build_args = build_parameter_keys.map((key: any) => `${key}=${node.parameters[key]}`);
      // Setup build context
      compose.services[node.normalized_ref].build = {
        context: node.service_path,
        args: [...build_args, 'ARCHITECT_DEBUG=1'],
      };

      if (node.command) {
        compose.services[node.normalized_ref].command = node.command;
      }

      // Mount the src directory
      const src_path = path.join(node.service_path, 'src');
      if (fs.pathExistsSync(src_path)) {
        compose.services[node.normalized_ref].volumes = [`${src_path}:/usr/src/app/src`];
      }

      const env_service = dependency_manager.environment.getServices()[node.ref];
      if (env_service && env_service.debug) {
        if (env_service.debug.dockerfile) {
          compose.services[node.normalized_ref].build!.dockerfile = path.resolve(node.service_path, env_service.debug.dockerfile);
        }
        if (env_service.debug.volumes) {
          compose.services[node.normalized_ref].volumes = env_service.debug.volumes.map((v) => path.resolve(node.service_path, v.split(':')[0]) + ':' + v.split(':')[1]);
        }
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
      service.environment.ARCHITECT[node_from.env_ref].datastores[node_to.key] = {
        host: `${node_to.protocol}${node_to.normalized_ref}`,
        port: node_to.ports.target.toString(),
        ...node_to.parameters,
      };
    } else if (node_to instanceof ExternalNode) {
      service.environment.ARCHITECT[node_from.env_ref].datastores[node_to.key] = {
        host: node_to.host,
        port: node_to.ports.target.toString(),
        ...node_to.parameters,
      };
    } else if (node_to instanceof ServiceNode) {
      service.environment.ARCHITECT[node_to.env_ref] = {
        host: `${node_to.protocol}${node_to.normalized_ref}`,
        port: node_to.ports.target.toString(),
        api: node_to.api.type,
      };
    }

    // Parse subscription logic
    if (edge instanceof NotificationEdge && node_to instanceof ServiceNode) {
      const to = node_to as ServiceNode;
      const to_subscriptions = to.service_config.getSubscriptions();
      service.environment.ARCHITECT[node_from.env_ref].subscriptions =
        Object.keys(to_subscriptions).reduce((subscriptions, publisher_name) => {
          Object.keys(to_subscriptions[publisher_name]).forEach(event_name => {
            subscriptions[event_name] = { [to.service_config.getName()]: to_subscriptions[publisher_name][event_name].data };
          });
          return subscriptions;
        }, service.environment.ARCHITECT[node_from.env_ref].subscriptions);
    } else if (!(node_to instanceof ExternalNode)) {
      compose.services[node_from.normalized_ref].depends_on.push(node_to.normalized_ref);
    }

    // Re-encode the ARCHITECT param
    service.environment.ARCHITECT = JSON.stringify(service.environment.ARCHITECT || {});
    compose.services[node_from.normalized_ref] = service;
  }

  return compose;
};
