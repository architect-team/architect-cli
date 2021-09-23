import execa, { Options } from 'execa';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import os from 'os';
import pLimit from 'p-limit';
import path from 'path';
import untildify from 'untildify';
import { ServiceNode, TaskNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import InterfacesNode from '../../dependency-manager/src/graph/node/interfaces';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import LocalPaths from '../../paths';
import PortUtil from '../utils/port';
import DockerComposeTemplate, { DockerService, DockerServiceBuild } from './template';

export class DockerComposeUtils {

  // used to namespace docker-compose projects so multiple deployments can happen to local
  public static DEFAULT_PROJECT = 'architect';

  public static async generate(graph: DependencyGraph): Promise<DockerComposeTemplate> {
    const compose: DockerComposeTemplate = {
      version: '3',
      services: {},
      volumes: {},
    };

    const limit = pLimit(5);
    const port_promises = [];

    for (const node of graph.nodes) {
      if (node.is_external) continue;
      if (!(node instanceof ServiceNode)) continue;
      for (const _ of node.ports) {
        port_promises.push(limit(() => PortUtil.getAvailablePort()));
      }
    }
    const available_ports = (await Promise.all(port_promises)).sort();

    const gateway_node = graph.nodes.find((node) => node instanceof GatewayNode);
    const gateway_port = gateway_node?.interfaces._default.port || 80;

    const gateway_links = new Set<string>();
    if (gateway_node) {
      for (const edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
        for (const interface_from of Object.keys(edge.interfaces_map)) {
          const host = interface_from === '@' ? 'arc.localhost' : `${interface_from}.arc.localhost`;
          gateway_links.add(`${gateway_node.ref}:${host}`);
        }
      }

      compose.services[gateway_node.ref] = {
        image: 'traefik:v2.4.14',
        command: [
          '--api.insecure=true',
          '--pilot.dashboard=false',
          '--accesslog=true',
          '--accesslog.filters.statusCodes=400-599',
          `--entryPoints.web.address=:${gateway_port}`,
          '--providers.docker=true',
          '--providers.docker.exposedByDefault=false',
          `--providers.docker.constraints=Label(\`traefik.port\`,\`${gateway_port}\`)`,
        ],
        ports: [
          // The HTTP port
          `${gateway_port}:${gateway_port}`,
          // The Web UI(enabled by--api.insecure = true)
          `${await PortUtil.getAvailablePort(8080)}:8080`,
        ],
        volumes: [
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
      };
    }

    let autoheal = false;

    const service_task_nodes = graph.nodes.filter((n) => n instanceof ServiceNode || n instanceof TaskNode) as (ServiceNode | TaskNode)[];

    // Enrich base service details
    for (const node of service_task_nodes) {
      if (node.is_external) continue;

      const ports = [];
      for (const port of node.ports) {
        ports.push(`${available_ports.shift()}:${port}`);
      }
      const formatted_environment_variables: Dictionary<string | null> = {};
      for (const [var_key, var_value] of Object.entries(node.config.environment)) {
        formatted_environment_variables[var_key] = var_value !== null ? var_value.replace(/\$/g, '$$$') : null; // https://docs.docker.com/compose/compose-file/compose-file-v3/#variable-substitution
      }
      const service = {
        environment: formatted_environment_variables,
      } as DockerService;

      if (ports.length) {
        service.ports = ports;
      }

      if (gateway_links.size) {
        service.external_links = [...gateway_links];
      }

      if (node.config.image) service.image = node.config.image;

      if (node.config.command?.length) { // docker-compose expects environment variables used in commands/entrypoints to be prefixed with $$, not $ in order to use variables local to the container
        service.command = node.config.command.map(command_part => command_part.replace(/\$/g, '$$$$'));
      }
      if (node.config.entrypoint?.length) {
        service.entrypoint = node.config.entrypoint.map(entrypoint_part => entrypoint_part.replace(/\$/g, '$$$$'));
      }

      const cpu = node.config.cpu;
      const memory = node.config.memory;
      if (cpu || memory) {
        service.deploy = { resources: { limits: {} } };
        if (cpu) { service.deploy.resources.limits.cpus = `${cpu}`; }
        if (memory) { service.deploy.resources.limits.memory = memory; }
      }

      if (node instanceof ServiceNode) {
        const liveness_probe = node.config.liveness_probe;
        if (liveness_probe) {
          if (!liveness_probe.command) {
            liveness_probe.command = ['CMD-SHELL', `curl -f http://localhost:${liveness_probe.port}${liveness_probe.path} || exit 1`];
          }
          service.healthcheck = {
            test: liveness_probe.command,
            interval: liveness_probe.interval,
            timeout: liveness_probe.timeout,
            retries: typeof liveness_probe.failure_threshold === 'string' ? parseInt(liveness_probe.failure_threshold) : liveness_probe.failure_threshold,
            start_period: liveness_probe.initial_delay,
          };
          if (!service.labels) {
            service.labels = [];
          }
          service.labels.push(`autoheal.${gateway_port}=true`);
          autoheal = true;
        }
      }

      const is_wsl = os.release().toLowerCase().includes('microsoft');
      if (process.platform === 'linux' && !is_wsl && process.env.NODE_ENV !== 'test') { // https://github.com/docker/for-linux/issues/264#issuecomment-772844305
        service.extra_hosts = ['host.docker.internal:host-gateway'];
      }

      const depends_on = graph.getDependsOn(node).map(n => n.ref);

      if (depends_on?.length) {
        service.depends_on = depends_on;
      }

      if (node.is_local) {
        const component_path = fs.lstatSync(node.local_path).isFile() ? path.dirname(node.local_path) : node.local_path;
        if (!node.config.image) {
          const build = node.config.build;
          const args = [];
          for (const [arg_key, arg] of Object.entries(build.args || {})) {
            args.push(`${arg_key}=${arg}`);
          }

          if (build.context || args.length) {
            const compose_build: any = {};
            if (build.context) compose_build.context = path.resolve(component_path, untildify(build.context));
            if (args.length) compose_build.args = args;
            service.build = compose_build;
          }

          if (build.dockerfile) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (service.build! as DockerServiceBuild).dockerfile = build.dockerfile;
          }
        } else if (!node.config.build) {
          throw new Error("Either `image` or `build` must be defined");
        }

        const volumes: string[] = [];
        for (const [key, spec] of Object.entries(node.config.volumes)) {
          let service_volume;
          if (spec.mount_path) {
            service_volume = spec.mount_path;
          } else {
            throw new Error(`mount_path must be specified for volume ${key} of service ${node.ref}`);
          }

          let volume;
          if (spec.host_path) {
            volume = `${path.resolve(component_path, spec.host_path)}:${service_volume}${spec.readonly ? ':ro' : ''}`;
          } else if (spec.key) {
            compose.volumes[spec.key] = { external: true };
            volume = `${spec.key}:${service_volume}${spec.readonly ? ':ro' : ''}`;
          } else {
            volume = service_volume;
          }
          volumes.push(volume);
        }
        if (volumes.length) service.volumes = volumes;
      }

      if (node instanceof TaskNode) {
        service.scale = 0; // set all tasks scale to 0 so they don't start but can be optionally invoked later
      }

      compose.services[node.ref] = service;
    }

    if (autoheal) {
      // https://github.com/moby/moby/pull/22719
      compose.services['autoheal'] = {
        image: 'willfarrell/autoheal:1.1.0',
        environment: {
          AUTOHEAL_CONTAINER_LABEL: `autoheal.${gateway_port}`,
        },
        volumes: [
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
      };
    }

    // Enrich service relationships
    for (const edge of graph.edges) {
      const node_from = graph.getNodeByRef(edge.from);

      if (node_from instanceof InterfacesNode) continue;

      for (const [interface_from, interface_to] of Object.entries(edge.interfaces_map)) {
        const [node_to, node_to_interface_name] = graph.followEdge(edge, interface_from);
        const node_to_ref = node_to.ref;

        if (!(node_to instanceof ServiceNode)) continue;
        if (node_to.is_external) continue;

        if (edge instanceof IngressEdge) {
          const service_to = compose.services[node_to_ref];
          const node_to_interface = node_to.interfaces[node_to_interface_name];
          service_to.environment = service_to.environment || {};

          let protocol = node_to_interface.protocol || 'http';
          // https://doc.traefik.io/traefik/user-guides/grpc/#with-http-h2c
          if (protocol === 'grpc') {
            protocol = 'h2c';
          }

          if (!service_to.labels) {
            service_to.labels = [];
          }

          if (!service_to.labels.includes(`traefik.enable=true`)) {
            service_to.labels.push(`traefik.enable=true`);
          }
          if (!service_to.labels.includes(`traefik.port=${gateway_port}`)) {
            service_to.labels.push(`traefik.port=${gateway_port}`);
          }


          /*
          if (interface_name === '@') {
            // @ is an invalid service name for traefik
            interface_name = '__at__';
          }
          */

          const host = interface_from === '@' ? 'arc.localhost' : `${interface_from}.arc.localhost`;

          const traefik_service = interface_from;

          const interfaces_node = graph.getNodeByRef(edge.to) as InterfacesNode;
          const component_interface = interfaces_node.config[interface_to];
          if (interfaces_node && component_interface?.ingress?.path) {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.rule=Host(\`${host}\`) && Path(${component_interface.ingress.path})`);
          } else {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.rule=Host(\`${host}\`)`);
          }
          if (!service_to.labels.includes(`traefik.http.routers.${traefik_service}.service=${traefik_service}-service`)) {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.service=${traefik_service}-service`);
          }
          service_to.labels.push(`traefik.http.services.${traefik_service}-service.loadbalancer.server.port=${node_to_interface.port}`);
          if (!service_to.labels.includes(`traefik.http.services.${traefik_service}-service.loadbalancer.server.scheme=${protocol}`)) {
            service_to.labels.push(`traefik.http.services.${traefik_service}-service.loadbalancer.server.scheme=${protocol}`);
          }
          if (node_to_interface.sticky) {
            service_to.labels.push(`traefik.http.services.${traefik_service}-service.loadBalancer.sticky.cookie=true`);
          }
        }
      }
    }

    return compose;
  }

  public static getConfigPaths(input: string): string[] {
    return [
      input,
      path.join(input, 'docker-compose.json'),
      path.join(input, 'docker-compose.yml'),
      path.join(input, 'docker-compose.yaml'),
    ];
  }

  public static readFromPath(input: string): [string, string] {
    const try_files = DockerComposeUtils.getConfigPaths(input);

    // Make sure the file exists
    let file_path;
    let file_contents;
    for (const file of try_files) {
      try {
        const data = fs.lstatSync(file);
        if (data.isFile()) {
          file_contents = fs.readFileSync(file, 'utf-8');
          file_path = file;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!file_contents || !file_path) {
      throw new Error(`No docker-compose file found at ${input}`);
    }

    return [file_path, file_contents];
  }

  public static loadDockerCompose(compose_path: string): DockerComposeTemplate {
    const [_, file_contents] = DockerComposeUtils.readFromPath(compose_path);

    let raw_config;
    try {
      raw_config = JSON.parse(file_contents);
    } catch {
      try {
        raw_config = yaml.load(file_contents);
        // eslint-disable-next-line no-empty
      } catch { }
    }

    if (!raw_config) {
      throw new Error('Invalid docker-compose format. Must be json or yaml.');
    }

    return raw_config;
  }

  public static async dockerCompose(args: string[], opts = { stdout: true }, execa_opts?: Options): Promise<any> {
    const cmd = execa('docker-compose', args, execa_opts);
    if (opts.stdout) {
      cmd.stdout?.pipe(process.stdout);
      cmd.stderr?.pipe(process.stderr);
    }
    try {
      return await cmd;
    } catch (err) {
      try {
        await execa('which', ['docker-compose']);
      } catch {
        throw new Error('Architect requires Docker Compose to be installed. Please install it and try again.');
      }
      throw err;
    }
  }

  public static async run(service_name: string, project_name: string, compose_file?: string): Promise<void> {
    const compose_file_args = compose_file ? ['-f', compose_file] : [];

    await DockerComposeUtils.dockerCompose([
      ...compose_file_args,
      '-p',
      project_name,
      'run',
      '--rm',
      service_name,
    ]);
  }

  public static buildComposeFilepath(config_dir: string, project_name: string): string {
    return path.join(config_dir, LocalPaths.LOCAL_DEPLOY_PATH, `${project_name}.yml`);
  }
}
