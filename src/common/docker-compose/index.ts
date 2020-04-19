import pLimit from 'p-limit';
import path from 'path';
import { DatastoreNode, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import LocalDependencyManager from '../dependency-manager/local-manager';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DockerComposeTemplate from './template';

export const generate = async (dependency_manager: LocalDependencyManager): Promise<DockerComposeTemplate> => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  const limit = pLimit(5);
  const port_promises = [];
  for (const node of dependency_manager.graph.nodes) {
    if (node instanceof ServiceNode || node instanceof DatastoreNode) {
      for (const _ of node.ports) {
        port_promises.push(limit(() => dependency_manager.getServicePort()));
      }
    }
  }
  const available_ports = (await Promise.all(port_promises)).sort();

  // Enrich base service details
  for (const node of dependency_manager.graph.nodes) {
    if (node instanceof GatewayNode) {
      compose.services[node.normalized_ref] = {
        image: 'jwilder/nginx-proxy',
        restart: 'always',
        ports: [`${await dependency_manager.gateway_port}:${node.ports[0]}`],
        volumes: ['/var/run/docker.sock:/tmp/docker.sock:ro'],
        depends_on: [],
        environment: {
          HTTPS_METHOD: 'noredirect',
        },
      };
    }

    if (node instanceof ServiceNode || node instanceof DatastoreNode) {
      const ports = [];
      for (const port of node.ports) {
        ports.push(`${available_ports.shift()}:${port}`);
      }
      compose.services[node.normalized_ref] = {
        image: node.image ? node.image : undefined,
        ports,
        depends_on: [],
        environment: node.parameters,
      };
    }

    if (node instanceof ServiceNode) {
      compose.services[node.normalized_ref].command = node.node_config.getCommand();
      if (node.node_config.getEntrypoint()) {
        compose.services[node.normalized_ref].entrypoint = node.node_config.getEntrypoint();
      }

      const platforms = node.node_config.getPlatforms();
      const docker_compose_config = platforms['docker-compose'];
      if (docker_compose_config) {
        compose.services[node.normalized_ref] = {
          ...docker_compose_config,
          ...compose.services[node.normalized_ref],
        };
      }
    }

    if (node instanceof LocalServiceNode) {
      if (!node.image) {
        const build_parameter_keys = Object.entries(node.node_config.getParameters()).filter(([_, value]) => (value && value.build_arg)).map(([key, _]) => key);
        const build_args = build_parameter_keys.map((key: any) => `${key}=${node.parameters[key]}`);
        // Setup build context
        compose.services[node.normalized_ref].build = {
          context: node.service_path,
          args: [...build_args],
        };

        if (node.node_config.getDockerfile()) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          compose.services[node.normalized_ref].build!.dockerfile = node.node_config.getDockerfile();
        }
      }

      const volumes: string[] = [];
      for (const [key, spec] of Object.entries(node.volumes)) {
        let service_volume;
        if (spec.mount_path?.startsWith('$')) {
          const volume_path = node.parameters[spec.mount_path.substr(1)];
          if (!volume_path) {
            throw new Error(`Parameter ${spec.mount_path} could not be found for node ${node.ref}`);
          }
          service_volume = volume_path.toString();
        } else if (spec.mount_path) {
          service_volume = spec.mount_path;
        } else {
          throw new Error(`mount_path must be specified for volume ${key}`);
        }

        let volume;
        if (spec.host_path) {
          volume = `${path.resolve(path.dirname(dependency_manager.config_path), spec.host_path)}:${service_volume}${spec.readonly ? ':ro' : ''}`;
        } else {
          volume = path.resolve(node.service_path, service_volume);
        }
        volumes.push(volume);
      }
      compose.services[node.normalized_ref].volumes = volumes;
    }

    // Append the dns_search value if it was provided in the environment config
    const dns_config = dependency_manager._environment.getDnsConfig();
    if (dns_config.searches) {
      compose.services[node.normalized_ref].dns_search = dns_config.searches;
    }
  }

  const seen_edges = new Set();
  // Enrich service relationships
  for (const edge of dependency_manager.graph.edges) {
    const node_from = dependency_manager.graph.getNodeByRef(edge.from);
    const node_to = dependency_manager.graph.getNodeByRef(edge.to);

    if (node_to instanceof ExternalNode) {
      continue;
    }

    if (edge instanceof IngressEdge) {
      const service_to = compose.services[node_to.normalized_ref];
      service_to.environment = service_to.environment || {};
      service_to.environment.VIRTUAL_HOST = `${edge.subdomain}.localhost`;
      service_to.environment.VIRTUAL_PORT = service_to.ports[0].split(':')[0];
      service_to.restart = 'always';
      compose.services[node_to.normalized_ref].depends_on.push(node_from.normalized_ref);
    } else if (edge instanceof ServiceEdge) {
      if (!seen_edges.has(`${edge.to}__${edge.from}`)) { // Detect circular refs and pick first one
        compose.services[node_from.normalized_ref].depends_on.push(node_to.normalized_ref);
        seen_edges.add(`${edge.to}__${edge.from}`);
        seen_edges.add(`${edge.from}__${edge.to}`);
      }
    }
  }

  return compose;
};
