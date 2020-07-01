import fs from 'fs-extra';
import pLimit from 'p-limit';
import path from 'path';
import { ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import InterfacesNode from '../../dependency-manager/src/graph/node/interfaces';
import LocalDependencyManager from '../dependency-manager/local-manager';
import DockerComposeTemplate from './template';

export const generate = async (dependency_manager: LocalDependencyManager): Promise<DockerComposeTemplate> => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  const limit = pLimit(5);
  const port_promises = [];
  const graph = await dependency_manager.getGraph();
  const environment = dependency_manager.environment;

  for (const node of graph.nodes) {
    if (node.is_external) continue;
    if (!(node instanceof ServiceNode)) continue;
    for (const _ of node.ports) {
      port_promises.push(limit(() => dependency_manager.getServicePort()));
    }
  }
  const available_ports = (await Promise.all(port_promises)).sort();

  // Enrich base service details
  for (const node of graph.nodes) {
    if (node.is_external) continue;

    if (node instanceof GatewayNode) {
      compose.services[node.normalized_ref] = {
        image: 'architectio/nginx-proxy:latest',
        restart: 'always',
        ports: [`${dependency_manager.gateway_port}:${dependency_manager.gateway_port}`],
        volumes: [
          '/var/run/docker.sock:/tmp/docker.sock:ro',
        ],
        depends_on: [],
        environment: {
          HTTPS_METHOD: 'noredirect',
          DISABLE_ACCESS_LOGS: 'true',
          HTTP_PORT: dependency_manager.gateway_port,
        },
        logging: {
          driver: 'none',
        },
      };
    }

    if (node instanceof ServiceNode) {
      const ports = [];
      for (const port of node.ports) {
        ports.push(`${available_ports.shift()}:${port}`);
      }
      compose.services[node.normalized_ref] = {
        ports,
        depends_on: [],
        environment: node.node_config.getEnvironmentVariables(),
      };

      if (node.node_config.getImage()) compose.services[node.normalized_ref].image = node.node_config.getImage();
    }

    if (node instanceof ServiceNode) {
      if (node.node_config.getCommand().length) compose.services[node.normalized_ref].command = node.node_config.getCommand();
      if (node.node_config.getEntrypoint().length) compose.services[node.normalized_ref].entrypoint = node.node_config.getEntrypoint();

      const platforms = node.node_config.getPlatforms();
      const docker_compose_config = platforms['docker-compose'];
      if (docker_compose_config) {
        compose.services[node.normalized_ref] = {
          ...docker_compose_config,
          ...compose.services[node.normalized_ref],
        };
      }
    }

    if (node.is_local && node instanceof ServiceNode) {
      const environment_component = environment.getComponentByServiceRef(node.ref);
      const component_path = fs.lstatSync(node.local_path).isFile() ? path.dirname(node.local_path) : node.local_path;
      if (!node.node_config.getImage()) {
        const build = node.node_config.getBuild();
        const args = [];
        for (const [arg_key, arg] of Object.entries(build.args || {})) {
          args.push(`${arg_key}=${arg}`);
        }

        if (build.context || args.length) {
          const compose_build: any = {};
          if (build.context) compose_build.context = path.resolve(component_path, build.context);
          if (args.length) compose_build.args = args;
          compose.services[node.normalized_ref].build = compose_build;
        }

        if (build.dockerfile) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          compose.services[node.normalized_ref].build!.dockerfile = build.dockerfile;
        }
      }

      const volumes: string[] = [];
      for (const [key, spec] of Object.entries(node.node_config.getVolumes())) {
        let service_volume;
        if (spec.mount_path) {
          service_volume = spec.mount_path;
        } else {
          throw new Error(`mount_path must be specified for volume ${key} of service ${node.ref}`);
        }

        const environment_service = environment_component?.getServiceByRef(node.ref);
        const environment_volume = environment_service?.getVolumes()[key] || environment_service?.getDebugOptions()?.getVolumes()[key];
        let volume;
        if (environment_volume?.host_path) {
          volume = `${path.resolve(path.dirname(dependency_manager.config_path), environment_volume?.host_path)}:${service_volume}${spec.readonly ? ':ro' : ''}`;
        } else if (spec.host_path) {
          volume = `${path.resolve(component_path, spec.host_path)}:${service_volume}${spec.readonly ? ':ro' : ''}`;
        } else {
          volume = service_volume;
        }
        volumes.push(volume);
      }
      if (volumes.length) compose.services[node.normalized_ref].volumes = volumes;
    }

    // Append the dns_search value if it was provided in the environment config
    const dns_config = environment.getDnsConfig();
    if (dns_config.searches) {
      compose.services[node.normalized_ref].dns_search = dns_config.searches;
    }
  }

  const seen_edges = new Set();
  // Enrich service relationships
  for (const edge of graph.edges) {
    const node_from = graph.getNodeByRef(edge.from);
    if (node_from instanceof InterfacesNode) continue;

    for (const interface_name of Object.keys(edge.interfaces_map)) {
      const [node_to, node_to_interface_name] = graph.followEdge(edge, interface_name);

      if (!(node_to instanceof ServiceNode)) continue;
      if (node_to.is_external) continue;

      let depends_from = node_from.normalized_ref;
      let depends_to = node_to.normalized_ref;

      if (edge instanceof IngressEdge) {
        const service_to = compose.services[node_to.normalized_ref];
        const node_to_interface = node_to.interfaces[node_to_interface_name];
        service_to.environment = service_to.environment || {};
        service_to.environment.VIRTUAL_HOST = `${interface_name}.localhost`;
        service_to.environment.VIRTUAL_PORT = node_to_interface.port;
        service_to.environment.VIRTUAL_PROTOCOL = node_to_interface.protocol || 'http';
        service_to.restart = 'always';

        // Flip for depends_on
        depends_from = node_to.normalized_ref;
        depends_to = node_from.normalized_ref;
      }

      if (!seen_edges.has(`${depends_to}__${depends_from}`)) { // Detect circular refs and pick first one
        compose.services[depends_from].depends_on.push(depends_to);
        seen_edges.add(`${depends_to}__${depends_from}`);
        seen_edges.add(`${depends_from}__${depends_to}`);
      }
    }
  }

  return compose;
};
