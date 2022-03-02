import { spawn } from 'child_process';
import execa, { Options } from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import os from 'os';
import pLimit from 'p-limit';
import path from 'path';
import untildify from 'untildify';
import which from 'which';
import { ServiceNode, TaskNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ComponentNode from '../../dependency-manager/src/graph/node/component';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import LocalPaths from '../../paths';
import PortUtil from '../utils/port';
import DockerComposeTemplate, { DockerService, DockerServiceBuild } from './template';

class LocalService {
  display_name!: string;
  service_name!: string;
}

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
        for (const { interface_from } of edge.interface_mappings) {
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

      /* Disable healthcheck since we removed autoheal container
      // Set liveness and healthcheck for services (not supported by Tasks)
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
        }
      }
      */

      const is_wsl = os.release().toLowerCase().includes('microsoft');
      if (process.platform === 'linux' && !is_wsl && process.env.TEST !== '1') { // https://github.com/docker/for-linux/issues/264#issuecomment-772844305
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
            const compose_build: DockerServiceBuild = {};
            if (build.context) compose_build.context = path.resolve(component_path, untildify(build.context));
            if (args.length) compose_build.args = args;
            service.build = compose_build;
          }

          if (build.dockerfile) {
            if (!service.build) {
              service.build = {};
            }
            (service.build as DockerServiceBuild).dockerfile = build.dockerfile;
          }

          if (build.target) {
            if (!service.build) {
              service.build = {};
            }
            (service.build as DockerServiceBuild).target = build.target;
          }
        } else if (!node.config.build) {
          throw new Error("Either `image` or `build` must be defined");
        }

        // Set volumes only for services (not supported by Tasks)
        if (node instanceof ServiceNode) {
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
              const volume_key = `${node.config.name}-${key}`;
              volume = `${volume_key}:${service_volume}`;
              compose.volumes[volume_key] = {};
            }
            volumes.push(volume);
          }
          if (volumes.length) service.volumes = volumes;
        }
      }

      if (node instanceof TaskNode) {
        service.scale = 0; // set all tasks scale to 0 so they don't start but can be optionally invoked later
      }

      compose.services[node.ref] = service;
    }

    // Enrich service relationships
    for (const edge of graph.edges) {
      const node_from = graph.getNodeByRef(edge.from);

      if (node_from instanceof ComponentNode) continue;

      for (const { interface_from, interface_to, node_to, node_to_interface_name } of graph.followEdge(edge)) {
        if (!(node_to instanceof ServiceNode)) continue;
        if (node_to.is_external) continue;

        if (edge instanceof IngressEdge) {
          const service_to = compose.services[node_to.ref];
          const node_to_interface = node_to.interfaces[node_to_interface_name];
          service_to.environment = service_to.environment || {};

          if (!service_to.labels) {
            service_to.labels = [];
          }

          if (!service_to.labels.includes(`traefik.enable=true`)) {
            service_to.labels.push(`traefik.enable=true`);
          }
          if (!service_to.labels.includes(`traefik.port=${gateway_port}`)) {
            service_to.labels.push(`traefik.port=${gateway_port}`);
          }

          const host = interface_from === '@' ? 'arc.localhost' : `${interface_from}.arc.localhost`;
          const traefik_service = `${node_to.ref}-${interface_to}`;

          const component_node = graph.getNodeByRef(edge.to) as ComponentNode;
          const component_interface = component_node.config.interfaces[interface_to];
          if (component_interface?.ingress?.path) {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.rule=Host(\`${host}\`) && PathPrefix(\`${component_interface.ingress.path}\`)`);
          } else {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.rule=Host(\`${host}\`)`);
          }
          if (!service_to.labels.includes(`traefik.http.routers.${traefik_service}.service=${traefik_service}-service`)) {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.service=${traefik_service}-service`);
          }
          service_to.labels.push(`traefik.http.services.${traefik_service}-service.loadbalancer.server.port=${node_to_interface.port}`);
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

  private static async dockerCommandCheck(command: () => Promise<void>): Promise<void> {
    try {
      return await command();
    } catch (err) {
      try {
        which.sync('docker');
      } catch {
        throw new Error('Architect requires Docker Compose to be installed. Please install it and try again.');
      }
      const stdout = execa.sync('docker', ['compose']).stdout;
      if (stdout.indexOf('docker compose COMMAND --help') !== -1) {
        throw new Error("Please update your local version of Docker");
      }
    }
  }

  public static async dockerComposeSpawn(args: string[], opts = { stdout: true, stdin: false }): Promise<any> {
    this.dockerCommandCheck(async () => {
      const stdio = [];
      stdio.push(opts.stdin ? process.stdin : undefined);
      stdio.push(opts.stdout ? process.stdout : undefined);
      stdio.push(opts.stdout ? process.stderr : undefined);
      const childProcess = spawn('docker', ['compose', ...args],
        { stdio: stdio });

      await new Promise((resolve) => {
        childProcess.on('close', resolve);
      });
    })
  }

  public static async dockerCompose(args: string[], opts = { stdout: true, stdin: false }, execa_opts?: Options): Promise<any> {
    this.dockerCommandCheck(async () => {
      const cmd = execa('docker', ["compose", ...args], execa_opts);
      if (opts.stdout) {
        cmd.stdout?.pipe(process.stdout);
        cmd.stderr?.pipe(process.stderr);
        if (opts.stdin) {
          cmd.stdin?.pipe(process.stdin);
        }
      }
      await cmd;
    });
  }

  public static async getLocalEnvironments(config_dir: string): Promise<string[]> {
    const search_directory = path.join(config_dir, LocalPaths.LOCAL_DEPLOY_PATH);
    const files = await fs.readdir(path.join(search_directory));
    return files.map((file) => file.split('.')[0]);
  }

  public static async isLocalEnvironment(config_dir: string, environment_name: string): Promise<boolean> {
    const local_enviromments = await DockerComposeUtils.getLocalEnvironments(config_dir);
    return !!(local_enviromments.find(env => env == environment_name));
  }

  public static async getLocalEnvironment(config_dir: string, environment_name?: string): Promise<string> {
    const search_directory = path.join(config_dir, LocalPaths.LOCAL_DEPLOY_PATH);
    const files = await fs.readdir(path.join(search_directory));
    const local_enviromments = files.map((file) => file.split('.')[0]);
    const answers: any = await inquirer.prompt([
      {
        when: !environment_name,
        type: 'autocomplete',
        name: 'environment',
        message: 'Select a environment',
        source: async () => {
          return local_enviromments;
        },
      },
    ]);
    return environment_name || answers.environment;
  }

  public static async getLocalServiceForEnvironment(environment: string, compose_file: string, service_name?: string): Promise<string> {
    const cmd = await execa('docker', ['compose', '-f', compose_file, '-p', environment, 'ps']);
    const lines = cmd.stdout.split('\n');
    //Remove the headers
    lines.shift();
    lines.shift();
    const services = lines.map(line => {
      // Split the line by space but not if the space is in double qoutes
      const line_parts = line.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      let name = line_parts[0];
      // Remove env name and counter: cloud_gateway_1
      name = name.substring(name.indexOf('_') + 1);
      name = name.substring(0, name.lastIndexOf('_'));
      const service = new LocalService();
      // Remove the slug for the display name and add the status of the service
      const slugless_name = name.substring(0, name.lastIndexOf('-'));
      if (!slugless_name) {
        return service;
      }
      service.display_name = slugless_name + ` (${line_parts[3].toUpperCase()})`;
      service.service_name = name;
      return service;
    }).filter((service) => {
      // Our services do not have a slug attached and have an empty display name at this point
      return service.display_name;
    });
    const answers: any = await inquirer.prompt([
      {
        when: !service_name,
        type: 'autocomplete',
        name: 'service',
        message: 'Select a service',
        source: async () => {
          return services.map(service => service.display_name);
        },
      },
    ]);
    const display_service_name = service_name || answers.service;
    const full_service_name = services.find((service) => service.display_name == display_service_name)?.service_name;
    if (!full_service_name) {
      throw new Error(`Could not find service=${display_service_name}`);
    }
    return full_service_name;
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
