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
    }

    if (node instanceof ServiceNode || node instanceof LocalServiceNode) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const ARCHITECT = JSON.parse(compose.services[node.normalized_ref].environment!.ARCHITECT);
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
    } else {
      if (!(node instanceof ExternalNode)) {
        compose.services[node.normalized_ref].image = node.image;
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
            subscriptions[event_name] = { [publisher_name]: to_subscriptions[event_name] };
          });
          return subscriptions;
        }, service.environment.ARCHITECT[edge.from.name].subscriptions);
    } else {
      if (!(edge.to instanceof ExternalNode)) {
        compose.services[edge.from.normalized_ref].depends_on.push(edge.to.normalized_ref);
      }
    }

    // Re-encode the ARCHITECT param
    service.environment.ARCHITECT = JSON.stringify(service.environment.ARCHITECT || {});
    compose.services[edge.from.normalized_ref] = service;
  });

  return compose;
};
