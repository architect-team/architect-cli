import path from 'path';
import fs from 'fs-extra';
import DependencyManager from '../dependency-manager';
import DockerComposeTemplate from './template';
import { LocalDependencyNode } from '../dependency-manager/node/local';
import SubscriptionEdge from '../dependency-manager/edge/subscription';

export const generate = (dependency_manager: DependencyManager): DockerComposeTemplate => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  // Enrich base service details
  dependency_manager.nodes.forEach(node => {
    compose.services[node.normalized_ref] = {
      ports: [`${node.expose_port}:${node.target_port}`],
      depends_on: [],
      environment: {
        HOST: node.normalized_ref,
        PORT: node.target_port,
        ARCHITECT_CURRENT_SERVICE: node.name,
        ARCHITECT: JSON.stringify({
          [node.name]: {
            host: `http://${node.normalized_ref}`,
            port: node.target_port,
            api: node.api_type,
            datastores: {},
            subscriptions: {},
          },
        }),
        ...node.parameters,
      },
    };

    if (node instanceof LocalDependencyNode) {
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
  dependency_manager.edges.forEach(edge => {
    // Parse the ARCHITECT param
    const service = compose.services[edge.from.normalized_ref];
    service.environment = service.environment || {};
    service.environment.ARCHITECT = service.environment.ARCHITECT ? JSON.parse(service.environment.ARCHITECT) : {};

    // Handle datastore credential enrichment to callers
    if (edge.to.isDatastore) {
      const datastore_key = edge.to.name.slice(edge.from.name.length + 1);
      service.environment.ARCHITECT[edge.from.name].datastores[datastore_key] = {
        host: edge.to.normalized_ref,
        port: edge.to.expose_port,
        ...edge.to.parameters,
      };
    } else {
      service.environment.ARCHITECT[edge.to.name] = {
        host: `http://${edge.to.normalized_ref}`,
        port: edge.to.expose_port,
        api: edge.to.api_type,
      };
    }

    // Parse subscription logic
    if (edge instanceof SubscriptionEdge) {
      service.environment.ARCHITECT[edge.from.name].subscriptions =
        Object.keys(edge.to.subscriptions).reduce((subscriptions, publisher_name) => {
          Object.keys(edge.to.subscriptions[publisher_name]).forEach(event_name => {
            subscriptions[event_name] = { [publisher_name]: edge.to.subscriptions[event_name] };
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
