import fs from 'fs-extra';
import path from 'path';
import DependencyManager, { DatastoreNode, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import { LocalServiceNode } from '../dependency-manager/local-service-node';
import DockerComposeTemplate from './template';

export const generate = (dependency_manager: DependencyManager, build_prod = false): DockerComposeTemplate => {
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
        ports: [`${node.ports.expose}:${node.ports.target}`],
        volumes: ['/var/run/docker.sock:/tmp/docker.sock:ro'],
        depends_on: [],
      }
    }

    if (node instanceof ServiceNode || node instanceof DatastoreNode) {
      compose.services[node.normalized_ref] = {
        image: node.image ? node.image : undefined,
        ports: [`${node.ports.expose}:${node.ports.target}`],
        depends_on: [],
        environment: {
          ...node.parameters,
          HOST: node.normalized_ref,
          PORT: node.ports.target.toString(),
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

        // Mount the src directory
        const src_path = path.join(node.service_path, 'src');
        if (fs.pathExistsSync(src_path)) {
          compose.services[node.normalized_ref].volumes = [`${src_path}:/usr/src/app/src`];
        }

        const volumes = node.service_config.getVolumes();
        if (volumes) {
          const existing_volumes = compose.services[node.normalized_ref].volumes || [];
          const config_volumes = Object.values(volumes).map(spec => {
            if (spec.mountPath.startsWith('$')) {
              const volume_path = node.parameters[spec.mountPath.substr(1)];
              if (!volume_path) {
                throw new Error(`Parameter ${spec.mountPath} could not be found for node ${node.ref}`);
              }
              return volume_path.toString();
            }
            return spec.mountPath;
          }, []);
          compose.services[node.normalized_ref].volumes = existing_volumes.concat(config_volumes);
        }

        const env_service = dependency_manager.environment.getServices()[node.ref];
        if (env_service && env_service.debug) {
          if (env_service.debug.dockerfile) {
            compose.services[node.normalized_ref].build!.dockerfile = path.resolve(node.service_path, env_service.debug.dockerfile);
          }

          if (env_service.debug.volumes) {
            compose.services[node.normalized_ref].volumes = env_service.debug.volumes.map((v) => {
              const volumeDef = v.split(':');
              if (volumeDef.length === 1) {
                return path.resolve(node.service_path, volumeDef[0]);
              }
              return path.resolve(node.service_path, v.split(':')[0]) + ':' + v.split(':')[1];
            });
          }

          if (env_service.debug.entrypoint) {
            compose.services[node.normalized_ref].entrypoint = env_service.debug.entrypoint;
          }
        }
      }
    }
  }

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
      compose.services[node_from.normalized_ref].depends_on.push(node_to.normalized_ref);
    }
  }

  return compose;
};
