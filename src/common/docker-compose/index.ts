import execa, { Options } from 'execa';
import fs from 'fs-extra';
import yaml from 'js-yaml';
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
import DockerComposeTemplate from './template';

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

    const gateway_links: string[] = [];
    for (const edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
      for (const interface_from of Object.keys(edge.interfaces_map)) {
        gateway_links.push(`gateway:${interface_from}.localhost`);
      }
    }

    const gateway_node = graph.nodes.find((node) => node instanceof GatewayNode);
    const gateway_port = gateway_node?.interfaces._default.port || 80;

    // Enrich base service details
    for (const node of graph.nodes) {
      if (node.is_external) continue;
      const url_safe_ref = node.ref;

      if (node instanceof GatewayNode) {
        compose.services[node.ref] = {
          image: 'traefik:v2.4',
          restart: 'always',
          command: [
            '--api.insecure=true',
            '--providers.docker',
            '--providers.docker.exposedByDefault=false',
          ],
          ports: [
            // The HTTP port
            `${gateway_port}:80`,
            // The Web UI(enabled by--api.insecure = true)
            '8080:8080',
          ],
          volumes: [
            '/var/run/docker.sock:/var/run/docker.sock',
          ],
        };
      }

      if (node instanceof ServiceNode || node instanceof TaskNode) {
        const ports = [];
        for (const port of node.ports) {
          ports.push(`${available_ports.shift()}:${port}`);
        }
        const formatted_environment_variables: Dictionary<string> = {};
        for (const [var_key, var_value] of Object.entries(node.node_config.getEnvironmentVariables())) {
          formatted_environment_variables[var_key] = var_value.replace(/\$/g, '$$$'); // https://docs.docker.com/compose/compose-file/compose-file-v3/#variable-substitution
        }
        compose.services[url_safe_ref] = {
          ports,
          environment: formatted_environment_variables,
        };

        if (gateway_links.length) {
          compose.services[url_safe_ref].external_links = gateway_links;
        }

        if (node.node_config.getImage()) compose.services[url_safe_ref].image = node.node_config.getImage();

        if (node.node_config.getCommand().length) { // docker-compose expects environment variables used in commands/entrypoints to be prefixed with $$, not $ in order to use variables local to the container
          compose.services[url_safe_ref].command = node.node_config.getCommand().map(command_part => command_part.replace(/\$([a-zA-Z0-9-_]+)/g, '$$$$$1'));
        }
        if (node.node_config.getEntrypoint().length) {
          compose.services[url_safe_ref].entrypoint = node.node_config.getEntrypoint().map(entrypoint_part => entrypoint_part.replace(/\$([a-zA-Z0-9-_]+)/g, '$$$$$1'));
        }

        const platforms = node.node_config.getPlatforms();
        const docker_compose_config = platforms['docker-compose'];
        if (docker_compose_config) {
          compose.services[url_safe_ref] = {
            ...docker_compose_config,
            ...compose.services[url_safe_ref],
          };
        }

        const cpu = node.node_config.getCpu();
        const memory = node.node_config.getMemory();
        if (cpu || memory) {
          const service = compose.services[url_safe_ref];
          service.deploy = { resources: { limits: {} } };
          if (cpu) { service.deploy.resources.limits.cpus = cpu; }
          if (memory) { service.deploy.resources.limits.memory = memory; }
        }

        if (process.platform === 'linux') { // https://github.com/docker/for-linux/issues/264#issuecomment-772844305
          compose.services[url_safe_ref].extra_hosts = ['host.docker.internal:host-gateway'];
        }
      }

      if (node.is_local && (node instanceof ServiceNode || node instanceof TaskNode)) {
        const component_path = fs.lstatSync(node.local_path).isFile() ? path.dirname(node.local_path) : node.local_path;
        if (!node.node_config.getImage()) {
          const build = node.node_config.getBuild();
          const args = [];
          for (const [arg_key, arg] of Object.entries(build.args || {})) {
            args.push(`${arg_key}=${arg}`);
          }

          if (build.context || args.length) {
            const compose_build: any = {};
            if (build.context) compose_build.context = path.resolve(component_path, untildify(build.context));
            if (args.length) compose_build.args = args;
            compose.services[url_safe_ref].build = compose_build;
          }

          if (build.dockerfile) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            compose.services[url_safe_ref].build!.dockerfile = build.dockerfile;
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

          let volume;
          if (spec.host_path) {
            volume = `${path.resolve(component_path, spec.host_path)}:${service_volume}${spec.readonly ? ':ro' : ''}`;
          } else {
            volume = service_volume;
          }
          volumes.push(volume);
        }
        if (volumes.length) compose.services[url_safe_ref].volumes = volumes;
      }

      if (node instanceof TaskNode) {
        compose.services[url_safe_ref].scale = 0; // set all tasks scale to 0 so they don't start but can be optionally invoked later
      }
    }

    const seen_edges = new Set();
    // Enrich service relationships
    for (const edge of graph.edges) {
      const node_from = graph.getNodeByRef(edge.from);
      if (node_from instanceof InterfacesNode) continue;
      const node_from_url_safe_ref = node_from.ref;

      for (const interface_name of Object.keys(edge.interfaces_map)) {
        const [node_to, node_to_interface_name] = graph.followEdge(edge, interface_name);
        const node_to_url_safe_ref = node_to.ref;

        if (!(node_to instanceof ServiceNode)) continue;
        if (node_to.is_external) continue;

        const depends_from = node_from_url_safe_ref;
        const depends_to = node_to_url_safe_ref;

        if (edge instanceof IngressEdge) {
          const service_to = compose.services[node_to_url_safe_ref];
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
          service_to.labels.push(`traefik.http.routers.${interface_name}.rule=Host(\`${interface_name}.localhost\`)`);
          service_to.labels.push(`traefik.http.routers.${interface_name}.service=${interface_name}-service`);
          service_to.labels.push(`traefik.http.services.${interface_name}-service.loadbalancer.server.port=${node_to_interface.port}`);
          service_to.labels.push(`traefik.http.services.${interface_name}-service.loadbalancer.server.scheme=${protocol}`);

          service_to.restart = 'always';
        }

        if (!seen_edges.has(`${depends_to}__${depends_from}`)) { // Detect circular refs and pick first one
          const service_from = compose.services[depends_from];
          if (!service_from.depends_on) {
            service_from.depends_on = [];
          }
          service_from.depends_on.push(depends_to);
          seen_edges.add(`${depends_to}__${depends_from}`);
          seen_edges.add(`${depends_from}__${depends_to}`);
        }
      }
    }

    return compose;
  }

  public static getConfigPaths(input: string) {
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
        raw_config = yaml.safeLoad(file_contents);
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

  public static async run(service_name: string, project_name: string, compose_file?: string) {
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

  public static buildComposeFilepath(config_dir: string, project_name: string) {
    return path.join(config_dir, LocalPaths.LOCAL_DEPLOY_PATH, `${project_name}.yml`);
  }
}
