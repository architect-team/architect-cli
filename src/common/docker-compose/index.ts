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
import { ArchitectError, ComponentNode, DependencyGraph, Dictionary, GatewayNode, IngressEdge, ResourceSlugUtils, ServiceNode, TaskNode } from '../../';
import LocalPaths from '../../paths';
import { restart } from '../docker/cmd';
import { DockerHelper, RequiresDocker } from '../docker/helper';
import PortUtil from '../utils/port';
import { DockerComposeProject, DockerComposeProjectWithConfig } from './project';
import DockerComposeTemplate, { DockerInspect, DockerService, DockerServiceBuild } from './template';

type GenerateOptions = {
  external_addr?: string;
  gateway_admin_port?: number;
  use_ssl?: boolean;
  config_dir?: string;
  getImage?: (ref: string) => string;
};

export class DockerComposeUtils {
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

  public static async generateTlsConfig(config_path: string): Promise<void> {
    const traefik_config = {
      tls: {
        stores: {
          default: {
            defaultCertificate: {
              certFile: '/etc/traefik-ssl/fullchain.pem',
              keyFile: '/etc/traefik-ssl/privkey.pem',
            },
          },
        },
        certificates: [{
          certFile: '/etc/traefik-ssl/fullchain.pem',
          keyFile: '/etc/traefik-ssl/privkey.pem',
        }],
      },
    };

    const traefik_yaml = yaml.dump(traefik_config);
    return fs.writeFile(path.join(config_path, `traefik.yaml`), traefik_yaml);
  }

  public static async generate(graph: DependencyGraph, options?: GenerateOptions): Promise<DockerComposeTemplate> {
    if (!options) {
      options = { gateway_admin_port: 8080, external_addr: 'arc.localhost', use_ssl: false };
    }
    const { gateway_admin_port, external_addr, use_ssl, config_dir } = options;

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
        for (const { interface_from } of edge.interface_mappings) {
          const host = interface_from === '@' ? external_addr : `${interface_from}.${external_addr}`;
          gateway_links.add(`${gateway_node.ref}:${host}`);
        }
      }

      compose.services[gateway_node.ref] = {
        image: 'traefik:v2.6.2',
        command: [
          '--api.insecure=true',
          '--pilot.dashboard=false',
          // '--log.level=DEBUG',
          '--accesslog=true',
          '--accesslog.filters.minDuration=1s',
          '--accesslog.filters.statusCodes=400-599',
          `--entryPoints.web.address=:${gateway_port}`,
          '--providers.docker=true',
          '--providers.docker.exposedByDefault=false',
          `--providers.docker.constraints=Label(\`traefik.port\`,\`${gateway_port}\`)`,
          ...(use_ssl ? [
            // Ignore local certs being invalid on proxy
            `--serversTransport.insecureSkipVerify=true`,
            // redirect http to https
            `--entryPoints.web.http.redirections.entryPoint.scheme=https`,
            `--entryPoints.web.http.redirections.entryPoint.permanent=true`,
            `--entryPoints.web.http.redirections.entryPoint.to=:${gateway_port}`,
            // tls certs
            '--providers.file.watch=false',
            `--providers.file.fileName=/etc/traefik-ssl/traefik.yaml`,
          ] : []),
        ],
        ports: [
          // The HTTP(S) port
          `${gateway_port}:${gateway_port}`,
          // The Web UI(enabled by--api.insecure = true)
          `${gateway_admin_port}:8080`,
        ],
        volumes: [
          ...(use_ssl ? [`${config_dir}:/etc/traefik-ssl/`] : []),
          '/var/run/docker.sock:/var/run/docker.sock:ro',
        ],
      };
    }

    const service_task_nodes = graph.nodes.filter((n) => n instanceof ServiceNode || n instanceof TaskNode) as (ServiceNode | TaskNode)[];

    const seen_build_map: Dictionary<string | undefined> = {};

    // Enrich base service details
    for (const node of service_task_nodes) {
      if (node.is_external) continue;

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
        if (!service.deploy) { service.deploy = {}; }
        service.deploy.resources = { limits: {} };
        if (cpu) { service.deploy.resources.limits.cpus = `${cpu}`; }
        if (memory) { service.deploy.resources.limits.memory = memory; }
      }

      if (!service.labels) {
        service.labels = [];
      }

      service.labels.push(`architect.ref=${node.config.metadata.architect_ref}`);

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
            retries: typeof liveness_probe.failure_threshold === 'string' ? parseInt(liveness_probe.failure_threshold) : liveness_probe.failure_threshold,
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

      const depends_on = graph.getDependsOn(node).map(n => n.ref);

      if (depends_on?.length) {
        service.depends_on = depends_on;
      }

      if (node.is_local) {
        const component_path = fs.lstatSync(node.local_path).isFile() ? path.dirname(node.local_path) : node.local_path;
        if (!node.config.image) {
          const build = node.config.build || {};

          if (!service.build) {
            service.build = {};
          }

          if (build.context) {
            service.build.context = path.resolve(component_path, untildify(build.context));
            if (!fs.existsSync(service.build.context)) {
              throw new Error(`The path ${service.build.context} used for the build context of service ${node.config.name} does not exist.`);
            }
          } else {
            // Fix bug with buildx using tmp dir
            service.build.context = path.resolve(component_path);
          }

          const args = [];
          for (const [arg_key, arg] of Object.entries(build.args || {})) {
            args.push(`${arg_key}=${arg}`);
          }
          if (args.length) {
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
        if (!service.deploy) { service.deploy = {}; }
        service.deploy.replicas = 0; // set all tasks scale to 0 so they don't start but can be optionally invoked later
      }



      if (service.build) {
        if (!service.image) {
          const image = options.getImage ? options.getImage(node.config.metadata.ref) : node.ref;
          service.image = image;
        }

        // Optimization to check if multiple services share the same dockerfile/build config and avoid building unnecessarily
        if (DockerHelper.composeVersion('>=2.6.0') && DockerHelper.buildXVersion('>=0.9.1')) { // docker-compose build.tags is only supported above these versions
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

          const host = interface_from === '@' ? external_addr : `${interface_from}.${external_addr}`;
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
          if (use_ssl) {
            service_to.labels.push(`traefik.http.routers.${traefik_service}.entrypoints=web`);
            service_to.labels.push(`traefik.http.routers.${traefik_service}.tls=true`);
          }

          if (component_interface?.protocol) {
            service_to.labels.push(`traefik.http.services.${traefik_service}-service.loadbalancer.server.scheme=${component_interface?.protocol}`);
          }
        }
      }
    }

    return compose;
  }

  private static getUrlProtocol(url?: string): string | undefined {
    if (!url) {
      return undefined;
    }
    try {
      // Slice removes the :
      return (new URL(url)).protocol.slice(0, -1);
    } catch {
      return undefined;
    }
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

  @RequiresDocker({ compose: true })
  public static dockerCompose(args: string[], execa_opts?: Options, use_console = false): execa.ExecaChildProcess<string> {
    if (use_console) {
      process.stdin.setRawMode(true);
    }
    const cmd = execa('docker', ['compose', ...args], execa_opts);
    if (use_console) {
      cmd.on('exit', () => {
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
    const inspect_cmd = await execa('docker', ['inspect', "--format='{{json .}}'", ...containers]);
    return inspect_cmd.stdout.split('\n').map(data => JSON.parse(data.substring(1, data.length - 1)));
  }

  /**
   * Combines the `docker compose ls` information with running container info to build a map of
   * environment -> container list.
   */
  public static async getLocalEnvironmentContainerMap(): Promise<{ [key: string]: DockerInspect[] }> {
    const running_cmd = await execa('docker', ['compose', 'ls', '--format=json']);
    const running_projects = JSON.parse(running_cmd.stdout).map((container: any) => {
      return container.Name;
    });

    const container_info = await this.getAllContainerInfo();
    const env_map: { [key: string]: DockerInspect[] } = {};
    for (const container of container_info) {
      if (!('architect.ref' in container.Config.Labels)) {
        continue;
      }
      const project = container.Config.Labels['com.docker.compose.project'];
      if (running_projects.indexOf(project) === -1) {
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
    return !!(local_enviromments.find(env => env == environment_name));
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
        message: 'Select a environment',
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
          return services.filter((s) => !input || s.name.toLowerCase().indexOf(input.toLowerCase()) >= 0);
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

  public static async watchContainersHealth(compose_file: string, environment_name: string, should_stop: () => boolean): Promise<boolean> {
    // To better emulate kubernetes we will always restart a failed container.
    // Kubernetes has 3 modes for Restart. Always, OnFailure and Never. If a liveness probe exists
    // then we will assume a Never policy is not expected. In this instance OnFailure and Always mean pretty
    // much the same thing so we will just Always restart

    const compose = yaml.load(fs.readFileSync(compose_file).toString()) as DockerComposeTemplate;

    const service_ref_map: Dictionary<string | undefined> = {};
    for (const [service_name, service] of Object.entries(compose.services)) {
      const service_ref = service.labels?.find((label) => label.startsWith('architect.ref='))?.split('=')[1];
      if (!service_ref) continue;
      service_ref_map[service_name] = service_ref;
    }

    const service_data_dictionary: Dictionary<{ last_restart_ms: number }> = {};

    // If the last time this loop runs, a container was restarted, we may have to run `docker compose stop`
    // because the restart can happen after the compose process was killed.
    let restarted = false;
    while (!should_stop()) {
      try {
        restarted = false;
        const container_states = JSON.parse((await DockerComposeUtils.dockerCompose(['-f', compose_file, '-p', environment_name, 'ps', '--format', 'json'])).stdout);
        for (const container_state of container_states) {
          const id = container_state.ID;
          const full_service_name = container_state.Service;

          const service_ref = service_ref_map[full_service_name];
          if (!service_ref) { continue; }

          const { resource_type } = ResourceSlugUtils.parse(service_ref);
          if (resource_type !== 'services') continue;

          const state = container_state.State.toLowerCase();
          const health = container_state.Health.toLowerCase();

          const bad_state = state !== 'running' && container_state.ExitCode !== 0;
          const bad_health = health === 'unhealthy';

          // Stop watching when container exited successfully.
          if (state === 'exited' && container_state.ExitCode === 0) {
            return true;
          }

          if (!service_data_dictionary[service_ref]) {
            service_data_dictionary[service_ref] = {
              last_restart_ms: Date.now(),
            };

            // Docker compose will only exit containers when stopping an up
            // If we had no service data and the container state is bad,
            // these containers may be from an old instance and we
            // are not yet in a bad state. If they are still bad after 5s, they
            // will be restarted.
            if (bad_state) {
              continue;
            }
          }

          if (bad_state || bad_health) {
            const service_data = service_data_dictionary[service_ref];

            service_data.last_restart_ms = Date.now();
            // Ensure the containers aren't terminating before we attempt to restart the container.
            // If the dev command gets killed between the start of this loop and here, the restart will cause the
            // containers to never stop and leave the command hanging.
            // Note: It's possible this result has changed because we `await` another Docker command during this
            // loops execution.
            if (!should_stop()) {
              console.log(chalk.red(`ERROR: ${service_ref} has encountered an error and is being restarted.`));
              // Even if the restart itself is interrupted, the restarted container can still be running.
              restarted = true;
              try {
                await restart(id);
              } catch (err) {
                console.log(chalk.red(`ERROR: ${service_ref} failed to restart.`));
                continue;
              }
            }
            // Docker compose will stop watching when there is a single container and it goes down.
            // If all containers go down at the same time it will wait for the restart and just move on. So only need this
            // for the case of 1 container with a health check.
            if (container_states.length == 1) {
              DockerComposeUtils.dockerCompose(['-f', compose_file, '-p', environment_name, 'logs', full_service_name, '--follow', '--since', new Date(service_data.last_restart_ms).toISOString()], { stdout: 'inherit' });
            }
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

    return restarted;
  }
}
