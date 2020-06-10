import fs from 'fs-extra';
import pLimit from 'p-limit';
import path from 'path';
import { ServiceInterfaceSpec, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
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
  const environment = await dependency_manager.getInterpolatedEnvironment();

  for (const node of graph.nodes) {
    if (node.is_external) continue;
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
        image: 'registry.architect.io/architect-nginx/proxy:latest',
        restart: 'always',
        ports: [`${dependency_manager.gateway_port}:${node.ports[0]}`],
        volumes: ['/var/run/docker.sock:/tmp/docker.sock:ro'],
        depends_on: [],
        environment: {
          HTTPS_METHOD: 'noredirect',
          DISABLE_ACCESS_LOGS: 'true',
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
        environment: {
          ...node.node_config.getEnvironmentVariables(),
          HOST: node.normalized_ref,
          PORT: node.ports[0] && node.ports[0].toString(),
        },
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const node_path = environment_component?.getExtends()?.startsWith('file:') ? environment_component?.getExtends()!.substr('file:'.length) : '';
      const component_path = fs.lstatSync(node_path).isFile() ? path.dirname(node_path) : node_path;
      if (!node.node_config.getImage()) {
        const build = node.node_config.getBuild();
        const args = [];
        for (const [arg_key, arg] of Object.entries(build.args || {})) {
          args.push(`${arg_key}=${arg}`);
        }

        if (build.context || args.length) {
          const compose_build: any = {};
          if (build.context) compose_build.context = build.context;
          if (args.length) compose_build.args = args;
          compose.services[node.normalized_ref].build = compose_build;
        }

        if (node.node_config.getDockerfile()) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          compose.services[node.normalized_ref].build!.dockerfile = node.node_config.getDockerfile();
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
    const node_to = graph.getNodeByRef(edge.to);

    if (node_to.is_external) {
      continue;
    }

    const external_interfaces_count = Object.values(node_to.interfaces).filter(i => i.subdomain).length;
    const interface_count = Object.keys(node_to.interfaces).length;
    if (interface_count > 1 && external_interfaces_count > 1) { // max one interface per container if external exists https://github.com/nginx-proxy/nginx-proxy#multiple-ports
      throw new Error(`Error in service definition for ${node_to.ref}. Only one ingress per service is supported locally.`);
    }

    if (edge instanceof IngressEdge) {
      const service_to = compose.services[node_to.normalized_ref];
      const to_interface = Object.values(node_to.interfaces).find((i: ServiceInterfaceSpec) => i.subdomain);
      service_to.environment = service_to.environment || {};
      service_to.environment.VIRTUAL_HOST = `${to_interface.subdomain}.localhost`;
      service_to.environment.VIRTUAL_PORT = service_to.ports[0] && service_to.ports[0].split(':')[0];
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
