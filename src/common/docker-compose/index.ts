import path from 'path';
import { DatastoreNode, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import LocalDependencyManager from '../dependency-manager/local-manager';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DockerComposeTemplate from './template';

export const generate = (dependency_manager: LocalDependencyManager, build_prod = false): DockerComposeTemplate => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  // Enrich base service details
  for (const node of dependency_manager.graph.nodes) {
    if (node instanceof GatewayNode) {
      compose.services[node.normalized_ref] = {
        image: 'jwilder/nginx-proxy',
        restart: 'always',
        ports: [`${node.ports[0].expose}:${node.ports[0].target}`],
        volumes: ['/var/run/docker.sock:/tmp/docker.sock:ro'],
        depends_on: [],
      };
    }

    if (node instanceof ServiceNode || node instanceof DatastoreNode) {
      compose.services[node.normalized_ref] = {
        image: node.image ? node.image : undefined,
        ports: node.ports.map(port_pair => `${port_pair.expose}:${port_pair.target}`),
        depends_on: [],
        environment: {
          ...node.parameters,
          HOST: node.normalized_ref,
          PORT: node.ports[0].target.toString(),
        },
      };
    }

    if (node instanceof ServiceNode) {
      compose.services[node.normalized_ref].command = node.service_config.getCommand();

      const platforms = node.service_config.getPlatforms();
      const docker_compose_config = platforms['docker-compose'];
      if (docker_compose_config) {
        compose.services[node.normalized_ref] = {
          ...docker_compose_config,
          ...compose.services[node.normalized_ref],
        };
      }

      if (node.service_config.getEntrypoint()) {
        compose.services[node.normalized_ref].entrypoint = node.service_config.getEntrypoint();
      }
    }

    if (node instanceof LocalServiceNode) {
      if (!node.image) {
        const build_parameter_keys = Object.entries(node.service_config.getParameters()).filter(([_, value]) => (value && value.build_arg)).map(([key, _]) => key);
        const build_args = build_parameter_keys.map((key: any) => `${key}=${node.parameters[key]}`);
        // Setup build context
        compose.services[node.normalized_ref].build = {
          context: node.service_path,
          args: [...build_args],
        };
      }

      if (!build_prod) {
        compose.services[node.normalized_ref].build?.args.push('ARCHITECT_DEBUG=1');

        const debug_options = node.service_config.getDebugOptions();
        if (debug_options) {
          compose.services[node.normalized_ref].command = debug_options.command;
        }

        let volumes: string[] = [];
        const service_volumes = node.service_config.getVolumes();
        const env_volumes = dependency_manager.environment.getVolumes(node.ref) || {};
        if (service_volumes) {
          const config_volumes = Object.entries(service_volumes).map(([key, spec]) => {
            let service_volume;
            if (spec.mountPath?.startsWith('$')) {
              const volume_path = node.parameters[spec.mountPath.substr(1)];
              if (!volume_path) {
                throw new Error(`Parameter ${spec.mountPath} could not be found for node ${node.ref}`);
              }
              service_volume = volume_path.toString();
            } else if (spec.mountPath) {
              service_volume = spec.mountPath;
            } else {
              throw new Error(`mountPath must be specified for volume ${key}`);
            }

            const env_volume = env_volumes[key];
            if (!env_volume) {
              return path.resolve(node.service_path, service_volume);
            }

            return `${path.resolve(path.dirname(dependency_manager.config_path), env_volume)}:${service_volume}${spec.readonly ? ':ro' : ''}`;
          }, []);
          volumes = volumes.concat(config_volumes);
        }
        compose.services[node.normalized_ref].volumes = volumes;

        const env_service = dependency_manager.environment.getServices()[node.ref];
        const env_service_debug = env_service?.getDebug();
        if (env_service_debug) {
          if (env_service_debug.dockerfile) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            compose.services[node.normalized_ref].build!.dockerfile = path.resolve(node.service_path, env_service_debug.dockerfile);
          }

          if (env_service_debug.entrypoint) {
            compose.services[node.normalized_ref].entrypoint = env_service_debug.entrypoint;
          }
        }
      }
    }

    // Append the dns_search value if it was provided in the environment config
    const dns_config = dependency_manager.environment.getDnsConfig();
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
