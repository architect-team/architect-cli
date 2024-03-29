import chalk from 'chalk';
import execa, { Options } from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import hash from 'object-hash';
import os from 'os';
import pLimit from 'p-limit';
import path from 'path';
import untildify from 'untildify';
import { ArchitectError, DependencyGraph, Dictionary, GatewayNode, IngressEdge, ResourceSlugUtils, ServiceNode, TaskNode } from '../../';
import LocalPaths from '../../paths';
import { DOCKER_COMPONENT_LABEL, DOCKER_IMAGE_LABEL } from '../docker/buildx.utils';
import { docker } from '../docker/cmd';
import { DockerHelper, RequiresDocker } from '../docker/helper';
import BuildPackUtils from '../utils/buildpack';
import PortUtil from '../utils/port';
import { DockerComposeProject, DockerComposeProjectWithConfig } from './project';
import DockerComposeTemplate, { DockerInspect, DockerService, DockerServiceBuild } from './template';

type GenerateOptions = {
  external_addr?: string;
  gateway_admin_port?: number;
  overlay_port?: number;
  ssl_cert?: string;
  ssl_key?: string;
  environment?: string;
  getImage?: (ref: string) => string;
};

export class DockerComposeUtils {
  // used to namespace docker-compose projects so multiple deployments can happen to local
  public static DEFAULT_PROJECT = 'architect';

  public static async getProjectName(default_project_name: string): Promise<string> {
    // 150 is somewhat arbitrary, but the intention is to give a more-than-reasonable max
    // length while leavning enough room for other things that get added to this (like the service name).
    // The max total size for this name is 255, but we use this for the file name too,
    // which can lead to an ENAMETOOLONG issue.
    // Note that this max is only achievable with a custom project name via `architect dev -e {SUPER LONG NAME}`,
    // the architect.yml enforces a much shorter max of 32 already, so this just prevents errors if a user tries to
    // do something interesting.
    default_project_name = default_project_name.substring(0, 150);

    const existing_project_count = (await DockerComposeUtils.getLocalEnvironments()).filter(env => {
      return env.startsWith(default_project_name);
    })?.length;

    if (existing_project_count) {
      return `${default_project_name}-${existing_project_count}`;
    } else {
      return default_project_name;
    }
  }

  public static generateTlsConfig(): string {
    return JSON.stringify({
      tls: {
        stores: {
          default: {
            defaultCertificate: {
              certFile: '/etc/fullchain.pem',
              keyFile: '/etc/privkey.pem',
            },
          },
        },
        certificates: [{
          certFile: '/etc/fullchain.pem',
          keyFile: '/etc/privkey.pem',
        }],
      },
    });
  }

  // eslint-disable-next-line complexity
  public static async generate(graph: DependencyGraph, options?: GenerateOptions): Promise<DockerComposeTemplate> {
    if (!options) {
      options = { gateway_admin_port: 8080, environment: 'architect', external_addr: 'arc.localhost' };
    }
    const { gateway_admin_port, overlay_port, environment, external_addr, ssl_cert, ssl_key } = options;

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
    const gateway_port = gateway_node?.interfaces._default.port || 443;

    const gateway_links = new Set<string>();
    if (gateway_node) {
      for (const edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
        const service_node = graph.getNodeByRef(edge.to);
        const service_interface = service_node.interfaces[edge.interface_to];
        const subdomain = service_interface.ingress?.subdomain || edge.interface_to;
        const host = subdomain === '@' ? external_addr : `${subdomain}.${external_addr}`;
        gateway_links.add(`${gateway_node.ref}:${host}`);
      }

      compose.services[gateway_node.ref] = {
        image: 'traefik:v2.9.8',
        command: [
          '--api.insecure=true',
          '--pilot.dashboard=false',
          // '--log.level=DEBUG',
          '--accesslog=true',
          '--accesslog.filters.minDuration=1s',
          '--accesslog.filters.statusCodes=400-599',
          `--entryPoints.web.address=:${gateway_port}`,
          '--providers.docker=true',
          '--providers.docker.allowEmptyServices=true',
          '--providers.docker.exposedByDefault=false',
          `--providers.docker.constraints=Label(\`traefik.port\`,\`${gateway_port}\`)`,
          `--entryPoints.web.forwardedHeaders.insecure=true`,
          `--entryPoints.web.proxyProtocol.insecure=true`,
          ...overlay_port ? [
          // Plugins
          `--experimental.plugins.rewritebody.modulename=github.com/packruler/rewrite-body`,
          `--experimental.plugins.rewritebody.version=v1.1.0`,
          ] : [],
          ...(ssl_cert && ssl_key ? [
            // Ignore local certs being invalid on proxy
            `--serversTransport.insecureSkipVerify=true`,
            // redirect http to https
            `--entryPoints.web.http.redirections.entryPoint.scheme=https`,
            `--entryPoints.web.http.redirections.entryPoint.permanent=true`,
            `--entryPoints.web.http.redirections.entryPoint.to=:${gateway_port}`,
            // tls certs
            '--providers.file.watch=false',
            `--providers.file.fileName=/etc/traefik.yaml`,
          ] : []),
        ],
        ports: [
          // The HTTP(S) port
          `${gateway_port}:${gateway_port}`,
          // The Web UI(enabled by--api.insecure = true)
          `${gateway_admin_port}:8080`,
        ],
        volumes: [
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
        stop_grace_period: '0s',
        ...(ssl_cert && ssl_key ? {
          entrypoint: [
            '/bin/sh',
            '-c',
            `
            echo "$$TRAEFIK_CONFIG" > /etc/traefik.yaml;
            echo "$$TRAEFIK_CERT" > /etc/fullchain.pem;
            echo "$$TRAEFIK_KEY" > /etc/privkey.pem;

            set -- "$$@" "$$0"

            sh ./entrypoint.sh $$@
            `,
          ],
          environment: {
            TRAEFIK_CONFIG: this.generateTlsConfig(),
            TRAEFIK_CERT: ssl_cert,
            TRAEFIK_KEY: ssl_key,
          },
        } : {}),
      };
    }

    const service_task_nodes = graph.nodes.filter((n) => n instanceof ServiceNode || n instanceof TaskNode) as (ServiceNode | TaskNode)[];

    const seen_build_map: Dictionary<string | undefined> = {};

    // Enrich base service details
    for (const node of service_task_nodes) {
      if (node.is_external) continue;

      const use_build_pack = BuildPackUtils.useBuildPack(node.local_path, node.config.build);

      const ports = [];
      for (const port of node.ports) {
        ports.push(`${available_ports.shift()}:${port}`);
      }
      const formatted_environment_variables: Dictionary<string | null> = {};
      if (process.env.TEST !== '1') {
        formatted_environment_variables.ARC_DEV = '1';
      }
      for (const [var_key, var_value] of Object.entries(node.config.environment)) {
        formatted_environment_variables[var_key] = var_value !== null ? var_value.replace(/\$/g, '$$$') : null; // https://docs.docker.com/compose/compose-file/compose-file-v3/#variable-substitution
      }
      const service: DockerService = {
        environment: formatted_environment_variables,
      };

      if (ports.length > 0) {
        service.ports = ports;
      }

      if (gateway_links.size > 0) {
        service.external_links = [...gateway_links];
      }

      if (node.config.image) service.image = node.config.image;

      if (node.config.command?.length && !use_build_pack) { // docker-compose expects environment variables used in commands/entrypoints to be prefixed with $$, not $ in order to use variables local to the container
        service.command = node.config.command.map(command_part => command_part.replace(/\$/g, '$$$$'));
      }
      if (node.config.entrypoint?.length) {
        service.entrypoint = node.config.entrypoint.map(entrypoint_part => entrypoint_part.replace(/\$/g, '$$$$'));
      }

      const cpu = node.config.cpu;
      const memory = node.config.memory;
      if (cpu || memory) {
        if (!service.deploy) {
          service.deploy = {};
        }
        service.deploy.resources = { limits: {} };
        if (cpu) {
          service.deploy.resources.limits.cpus = `${cpu}`;
        }
        if (memory) {
          service.deploy.resources.limits.memory = memory;
        }
      }

      if (!service.labels) {
        service.labels = [];
      }
      service.labels.push(`architect.ref=${node.config.metadata.ref}`);

      // Set liveness and healthcheck for services (not supported by Tasks)
      if (node instanceof ServiceNode) {
        const liveness_probe = node.config.liveness_probe;
        if (liveness_probe) {
          if (!liveness_probe.command) {
            liveness_probe.command = ['CMD-SHELL', `curl -f http://localhost:${liveness_probe.port}${liveness_probe.path} || exit 1`]; // deprecated
          } else {
            liveness_probe.command = ['CMD', ...liveness_probe.command];
          }
          service.healthcheck = {
            test: liveness_probe.command,
            interval: liveness_probe.interval,
            timeout: liveness_probe.timeout,
            retries: typeof liveness_probe.failure_threshold === 'string' ? Number.parseInt(liveness_probe.failure_threshold) : liveness_probe.failure_threshold,
            start_period: liveness_probe.initial_delay,
          };
          if (!service.labels) {
            service.labels = [];
          }
        }
      }

      const is_wsl = os.release().toLowerCase().includes('microsoft');
      if (process.platform === 'linux' && !is_wsl && process.env.TEST !== '1') { // https://github.com/docker/for-linux/issues/264#issuecomment-772844305
        service.extra_hosts = ['host.docker.internal:host-gateway'];
      }

      const depends_on_nodes = graph.getDependsOn(node);
      if (depends_on_nodes?.length) {
        const depends_on: Dictionary<{ condition: string }> = {};
        for (const node of depends_on_nodes) {
          depends_on[node.ref] = {
            condition: node instanceof ServiceNode && node.config.liveness_probe ? 'service_healthy' : 'service_started',
          };
        }
        service.depends_on = depends_on;
      }

      if (node.local_path) {
        if (!node.config.image && !use_build_pack) {
          const build = node.config.build || {};

          if (!service.build) {
            service.build = {};
          }

          if (build.context) {
            service.build.context = path.resolve(node.local_path, untildify(build.context));
            if (!fs.existsSync(service.build.context)) {
              throw new Error(`The path ${service.build.context} used for the build context of service ${node.config.name} does not exist.`);
            }
          } else {
            // Fix bug with buildx using tmp dir
            service.build.context = path.resolve(node.local_path);
          }

          const args = [];
          for (const [arg_key, arg] of Object.entries(build.args || {})) {
            args.push(`${arg_key}=${arg}`);
          }
          if (args.length > 0) {
            service.build.args = args;
          }

          if (build.dockerfile) {
            service.build.dockerfile = build.dockerfile;
          }

          if (build.target) {
            service.build.target = build.target;
          }
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
              volume = `${path.resolve(node.local_path, untildify(spec.host_path))}:${service_volume}${spec.readonly ? ':ro' : ''}`;
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
          if (volumes.length > 0) service.volumes = volumes;
        }
      }

      if (node instanceof TaskNode) {
        if (!service.deploy) {
          service.deploy = {};
        }
        service.deploy.replicas = 0; // set all tasks scale to 0 so they don't start but can be optionally invoked later
      }

      if (!service.image) {
        // eslint-disable-next-line unicorn/consistent-destructuring
        service.image = options.getImage ? options.getImage(node.config.metadata.ref) : node.ref;
      }

      // Optimization to check if multiple services share the same dockerfile/build config and avoid building unnecessarily
      if (service.build && DockerHelper.composeVersion('>=2.6.0') && DockerHelper.buildXVersion('>=0.9.1')) { // docker-compose build.tags is only supported above these versions
        const build_hash = hash(service.build);
        const existing_service = seen_build_map[build_hash];
        if (!existing_service) {
          seen_build_map[build_hash] = node.ref;
          service.build.tags = [service.image];
        } else {
          const existing_build = compose.services[existing_service].build as DockerServiceBuild;
          if (!existing_build.tags) existing_build.tags = [];
          existing_build.tags.push(service.image);

          delete service.build;
        }
      }

      if (service.build) {
        // Add labels to enrich image filtering
        if (!service.build.labels) {
          service.build.labels = [];
        }
        service.build.labels.push(DOCKER_IMAGE_LABEL);

        const { component_name } = ResourceSlugUtils.parse(node.config.metadata.ref);
        service.build.labels.push(`${DOCKER_COMPONENT_LABEL}=${component_name}`);
      }

      compose.services[node.ref] = service;
    }

    // Enrich service relationships
    for (const edge of graph.edges) {
      const node_from = graph.getNodeByRef(edge.from);

      const node_to = graph.getNodeByRef(edge.to);

      if (!(node_to instanceof ServiceNode)) continue;
      if (node_to.is_external) continue;

      if (edge instanceof IngressEdge) {
        const service_to = compose.services[node_to.ref];
        const node_to_interface = node_to.interfaces[edge.interface_to];
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

        const ingress = node_to_interface.ingress;
        const subdomain = ingress?.subdomain || edge.interface_to;

        const host = subdomain === '@' ? external_addr : `${subdomain}.${external_addr}`;
        const traefik_service = `${node_to.ref}-${edge.interface_to}`;

        if (ingress?.path) {
          service_to.labels.push(`traefik.http.routers.${traefik_service}.rule=Host(\`${host}\`) && PathPrefix(\`${ingress.path}\`)`);
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
        if (ssl_cert && ssl_key) {
          service_to.labels.push(`traefik.http.routers.${traefik_service}.entrypoints=web`, `traefik.http.routers.${traefik_service}.tls=true`);
        }

        if (overlay_port) {
          service_to.labels.push(
            `traefik.http.middlewares.${traefik_service}-rewritebody.plugin.rewritebody.lastModified=true`,
            `traefik.http.middlewares.${traefik_service}-rewritebody.plugin.rewritebody.rewrites.regex=</head>`,
            `traefik.http.middlewares.${traefik_service}-rewritebody.plugin.rewritebody.rewrites.replacement=<script id="architect-script" async type="text/javascript" src="http://localhost:${overlay_port}" data-environment="${environment}" data-service="${node_to.config.metadata.ref}"></script></head>`,
            `traefik.http.routers.${traefik_service}.middlewares=${traefik_service}-rewritebody@docker`,
          );
        }

        if (node_to_interface.protocol && node_to_interface.protocol !== 'http') {
          service_to.labels.push(`traefik.http.services.${traefik_service}-service.loadbalancer.server.scheme=${node_to_interface.protocol}`);
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

    if (!file_contents) {
      throw new Error(`The file ${input} appears to be empty. Nothing to convert.`);
    }

    if (!file_path) {
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
      } catch { }
    }

    if (!raw_config) {
      throw new Error('Invalid docker-compose format. Must be json or yaml.');
    }

    return raw_config;
  }

  @RequiresDocker({ compose: true })
  public static dockerCompose(args: string[], execa_opts?: Options, use_console = false): execa.ExecaChildProcess<string> {
    if (use_console && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    const cmd = execa('docker', ['compose', ...args], execa_opts);
    if (use_console) {
      cmd.on('exit', () => {
        // eslint-disable-next-line no-process-exit
        process.exit(cmd.exitCode || 0);
      });
    }
    return cmd;
  }

  /**
   * Runs `docker inspect` on all containers and returns the resulting json as an array of objects.
   */
  public static async getAllContainerInfo(): Promise<DockerInspect[]> {
    const container_cmd = await execa('docker', ['ps', '-aq']);
    if (!container_cmd.stdout) {
      return [];
    }
    const containers = container_cmd.stdout.split('\n');
    const inspect_cmd = await docker(['inspect', '--format=\'{{json .}}\'', ...containers], { stdout: false });
    const container_states = inspect_cmd.stdout.split('\n').map((data: any) => JSON.parse(data.substring(1, data.length - 1)));
    return container_states;
  }

  /**
   * Combines the `docker compose ls` information with running container info to build a map of
   * environment -> container list.
   */
  public static async getLocalEnvironmentContainerMap(): Promise<{ [key: string]: DockerInspect[] }> {
    const running_cmd = await execa('docker', ['compose', 'ls', '--format=json']);
    const running_projects = new Set(JSON.parse(running_cmd.stdout).map((container: any) => {
      return container.Name;
    }));

    const container_info = await this.getAllContainerInfo();
    const env_map: { [key: string]: DockerInspect[] } = {};
    for (const container of container_info) {
      if (!('architect.ref' in container.Config.Labels)) {
        continue;
      }
      const project = container.Config.Labels['com.docker.compose.project'];
      if (!running_projects.has(project)) {
        continue;
      }

      if (!(project in env_map)) {
        env_map[project] = [];
      }
      env_map[project].push(container);
    }
    return env_map;
  }

  public static async getLocalEnvironments(): Promise<string[]> {
    return Object.keys(await this.getLocalEnvironmentContainerMap());
  }

  public static async isLocalEnvironment(environment_name: string): Promise<boolean> {
    const local_enviromments = await DockerComposeUtils.getLocalEnvironments();
    return Boolean(local_enviromments.includes(environment_name));
  }

  public static async getLocalEnvironment(config_dir: string, environment_name?: string): Promise<string> {
    const { stdout } = await DockerComposeUtils.dockerCompose(['ls', '--format', 'json']);

    const projects: DockerComposeProject[] = JSON.parse(stdout);

    let architect_projects: DockerComposeProjectWithConfig[] = [];
    if (projects.length > 0) {
      if (projects[0].ConfigFiles !== undefined) {
        architect_projects = (projects as DockerComposeProjectWithConfig[]).filter((project) =>
          path.resolve(project.ConfigFiles).startsWith(path.resolve(config_dir)));
      } else {
        // Older versions of compose do not have a ConfigFiles key. We need to look at the compose file(s) written
        // to the local deploy path and compare them to the DockerComposeProject.Name
        const search_directory = path.join(config_dir, LocalPaths.LOCAL_DEPLOY_PATH);
        const files = await fs.readdir(path.join(search_directory));
        const local_enviromments = files.map((file) => file.split('.')[0]);

        // eslint-disable-next-line unicorn/no-array-reduce
        architect_projects = projects.reduce((filtered: DockerComposeProjectWithConfig[], project) => {
          const env_index = local_enviromments.indexOf(project.Name);
          if (env_index >= 0) {
            project.ConfigFiles = path.join(search_directory, files[env_index]);
            filtered.push(project as DockerComposeProjectWithConfig);
          }
          return filtered;
        }, []);
      }
    }

    if (environment_name) {
      const project = architect_projects.find(project => project.Name === environment_name);
      if (!project) {
        throw new ArchitectError(`There is no active environment named: ${environment_name}`);
      }
      return environment_name;
    }

    if (architect_projects.length === 0) {
      throw new ArchitectError('There are no active dev environments.');
    }

    if (architect_projects.length === 1) {
      return architect_projects[0].Name;
    }

    const answers = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'environment',
        message: 'Select an environment',
        source: (_: any, input: string) => {
          return architect_projects.map(project => ({
            name: `${project.Name} ${project.Status}`,
            value: project.Name,
          }));
        },
      },
    ]);
    return answers.environment;
  }

  public static async getLocalServiceForEnvironment(compose_file: string, service_name?: string): Promise<{ display_name: string, name: string }> {
    // docker-compose -f and -p don't work in tandem
    const compose = yaml.load(fs.readFileSync(compose_file).toString()) as DockerComposeTemplate;

    const services: { name: string, value: { display_name: string, name: string } }[] = [];
    for (const [service_name, service] of Object.entries(compose.services)) {
      const display_name = service.labels?.find((label) => label.startsWith('architect.ref='))?.split('=')[1];
      if (!display_name) continue;
      services.push({ name: display_name, value: { name: service_name, display_name } });
    }

    const answers: { service: { display_name: string, name: string } } = await inquirer.prompt([
      {
        when: !service_name,
        type: 'autocomplete',
        name: 'service',
        message: 'Select a service',
        source: async (_: any, input: string) => {
          return services.filter((s) => !input || s.name.toLowerCase().includes(input.toLowerCase()));
        },
      },
    ]);

    let selected_service;
    if (service_name) {
      selected_service = services.find((service) => service.name === service_name)?.value;
      if (!selected_service) {
        throw new Error(`Could not find service=${service_name}. Available services are:\n${services.map((s) => s.name).join('\n')}`);
      }
    } else {
      selected_service = answers.service;
    }
    return selected_service;
  }

  public static async run(service_name: string, project_name: string, compose_file?: string): Promise<void> {
    const compose_file_args = compose_file ? ['-f', compose_file] : [];

    await DockerComposeUtils.dockerCompose([
      ...compose_file_args,
      '-p',
      project_name,
      'run',
      '--no-deps',
      '--rm',
      service_name,
    ], { stdio: 'inherit' });
  }

  public static buildComposeFilepath(config_dir: string, project_name: string): string {
    return path.join(config_dir, LocalPaths.LOCAL_DEPLOY_PATH, `${project_name}.yml`);
  }

  public static async writeCompose(compose_file: string, compose: string): Promise<void> {
    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, compose);
  }

  public static async watchContainersHealth(compose_file: string, environment_name: string, should_stop: () => boolean): Promise<void> {
    // To better emulate kubernetes we will always restart a failed container.
    // Kubernetes has 3 modes for Restart. Always, OnFailure and Never. If a liveness probe exists
    // then we will assume a Never policy is not expected. In this instance OnFailure and Always mean pretty
    // much the same thing so we will just Always restart

    const compose = yaml.load(fs.readFileSync(compose_file).toString()) as DockerComposeTemplate;

    const services_watched: Set<string> = new Set();
    for (const service of Object.values(compose.services)) {
      const service_ref = service.labels?.find((label) => label.startsWith('architect.ref='))?.split('=')[1];
      if (!service_ref) continue;
      services_watched.add(service_ref);
    }

    const start_time = Date.now();

    const last_health_failure_map: Dictionary<string> = {};

    while (!should_stop()) {
      try {
        // Fetch latest container mapping to check for the latest status every iteration
        const container_map = await this.getLocalEnvironmentContainerMap();
        // Only verify container status a part of the environment
        const container_states = container_map[environment_name] || [];

        for (const container_state of container_states) {
          const service_ref = container_state.Config.Labels['architect.ref'];

          if (!services_watched.has(service_ref)) {
            continue;
          }

          const { resource_type } = ResourceSlugUtils.parse(service_ref);
          if (resource_type !== 'services') continue;

          if (start_time > new Date(container_state.State.StartedAt).getTime()) {
            continue; // Skip containers that were started before the watch started
          }

          const state = container_state.State.Status.toLowerCase();
          const health = container_state.State?.Health?.Status?.toLowerCase();

          const bad_state = state !== 'running' && container_state.State.ExitCode !== 0 && health !== 'starting';
          const bad_health = health === 'unhealthy';

          const failed_health_logs = container_state.State?.Health?.Log?.filter(log => log.ExitCode !== 0) || [];

          if (health !== 'healthy' && failed_health_logs.length > 0) {
            const latest_health_failure = failed_health_logs[failed_health_logs.length - 1];

            // Prevent liveness error probe failure from logging more often than the liveness probe runs.
            // Default liveness probe interval is 30s and without checking last error time, this message will
            // print every loop iteration.
            if (!last_health_failure_map[service_ref] || last_health_failure_map[service_ref] !== latest_health_failure.Start) {
              console.log(chalk.red(`\nThe liveness probe has failed for '${service_ref}'`));
              console.log(chalk.red(`ERROR: ${latest_health_failure.Output}`));
              last_health_failure_map[service_ref] = latest_health_failure.Start;
            }
          }

          if ((bad_state || bad_health) &&
              container_states.length > 1 && // Don't restart if there is only 1 container running because it will kill the main process
              // Ensure the containers aren't terminating before we attempt to restart the container.
              // If the dev command gets killed between the start of this loop and here, the restart will cause the
              // containers to never stop and leave the command hanging.
              // Note: It's possible this result has changed because we `await` another Docker command during this
              // loops execution.
              !should_stop()) {
            console.log(chalk.red(`ERROR: ${service_ref} has encountered an error and is being restarted.`));
            const compose_args = ['-f', compose_file, '-p', environment_name, 'restart', container_state.Config.Labels['com.docker.compose.service']];
            await DockerComposeUtils.dockerCompose(compose_args, { stdio: 'inherit' });
          }
        }

        // Wait 5 seconds before checking again. Waiting in 1s increments and checking if we should return early
        // so that awaiting the result of this promise takes at most 1s and not 5s.
        for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 1000));
          if (should_stop()) {
            break;
          }
        }
      } catch (ex) {
        // Ignore any errors. Since this service just watches services health it does
        // not matter if an error occurs we should not stop a running dev instance
        // just because the `watcher` failed.
      }
    }
  }
}
