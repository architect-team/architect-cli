import path from 'path';
import fs from 'fs-extra';
import DockerComposeTemplate from './template';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DependencyManager, { ServiceNode, DatastoreNode } from '../../dependency-manager/src';

export const generate = (dependency_manager: DependencyManager): DockerComposeTemplate => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  // Enrich base service details
  dependency_manager.graph.nodes.forEach(node => {
    compose.services[node.normalized_ref] = {
      ports: [`${node.ports.expose}:${node.ports.target}`],
      depends_on: [],
      environment: {
        HOST: node.normalized_ref,
        PORT: node.ports.target,
        ARCHITECT: JSON.stringify({
          [node.name]: {
            host: `http://${node.normalized_ref}`,
            port: node.ports.target,
            datastores: {},
            subscriptions: {},
          },
        }),
        ARCHITECT_CURRENT_SERVICE: node.name,
        ...node.parameters,
      },
    };

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
      compose.services[node.normalized_ref].image = node.image;
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
      const datastore_key = edge.to.name.slice(edge.from.normalized_ref.length + 1);
      service.environment.ARCHITECT[edge.from.name].datastores[datastore_key] = {
        host: edge.to.normalized_ref,
        port: edge.to.ports.target,
        ...edge.to.parameters,
      };
    } else if (edge.to instanceof ServiceNode || edge.to instanceof LocalServiceNode) {
      service.environment.ARCHITECT[edge.to.name] = {
        host: `http://${edge.to.normalized_ref}`,
        port: edge.to.ports.target,
        api: edge.to.api.type,
      };
    }

    // Parse subscription logic
    if (edge.type === 'notification' && (edge.to instanceof ServiceNode || edge.to instanceof LocalServiceNode)) {
      const to = edge.to as ServiceNode;
      service.environment.ARCHITECT[edge.from.name].subscriptions =
        Object.keys(to.subscriptions).reduce((subscriptions, publisher_name) => {
          Object.keys(to.subscriptions[publisher_name]).forEach(event_name => {
            subscriptions[event_name] = { [publisher_name]: to.subscriptions[event_name] };
          });
          return subscriptions;
        }, service.environment.ARCHITECT[edge.from.name].subscriptions);
    } else {
      compose.services[edge.from.normalized_ref].depends_on.push(edge.to.normalized_ref);
    }

    // Re-encode the ARCHITECT param
    service.environment.ARCHITECT = JSON.stringify(service.environment.ARCHITECT || {});
    compose.services[edge.from.normalized_ref] = service;
  });

  return compose;
};
