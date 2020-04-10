import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import path from 'path';
import DependencyManager, { EnvironmentConfigBuilder, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import { readIfFile } from '../utils/file';
import PortUtil from '../utils/port';
import LocalDependencyGraph from './local-graph';
import { LocalServiceNode } from './local-service-node';

declare type LinkedServicesMap = { [serviceName: string]: string };

export default class LocalDependencyManager extends DependencyManager {
  graph: LocalDependencyGraph;
  api: AxiosInstance;
  config_path: string;
  linked_services: LinkedServicesMap;

  constructor(api: AxiosInstance, config_path = '', linked_services: LinkedServicesMap = {}) {
    const env_config = config_path
      ? EnvironmentConfigBuilder.buildFromPath(config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});

    // Only include in cli since it will read files off disk
    for (const vault of Object.values(env_config.getVaults())) {
      vault.client_token = readIfFile(vault.client_token);
      vault.role_id = readIfFile(vault.role_id);
      vault.secret_id = readIfFile(vault.secret_id);
    }

    super(env_config);
    this.graph = new LocalDependencyGraph(env_config.__version);
    this.api = api;
    this.config_path = config_path || '';
    this.linked_services = linked_services;
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string, linked_services: LinkedServicesMap = {}): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path, linked_services);

    const dependency_resolvers = [];
    for (const [ref, env_svc_cfg] of Object.entries(dependency_manager.environment.getServices())) {

      if (env_svc_cfg.host && env_svc_cfg.port) {
        await dependency_manager.loadExternalService(env_svc_cfg, ref);
      } else {
        let svc_node: ServiceNode;
        const [name, tag] = ref.split(':');

        if (env_svc_cfg.debug?.path) {
          const svc_path = path.join(path.dirname(env_config_path), env_svc_cfg.debug.path);
          svc_node = await dependency_manager.loadLocalService(svc_path);
        } else if (linked_services.hasOwnProperty(name)) {
          console.log(`Using locally linked ${chalk.blue(name)} found at ${chalk.blue(linked_services[name])}`);
          svc_node = await dependency_manager.loadLocalService(linked_services[name]);
        } else {
          svc_node = await dependency_manager.loadService(name, tag);
        }
        await dependency_manager.loadDatastores(svc_node);
        dependency_resolvers.push(() => dependency_manager.loadDependencies(svc_node));

        if (env_svc_cfg.ingress) {
          const gateway = new GatewayNode({
            ports: { target: 80, expose: await dependency_manager.getServicePort(80) },
            parameters: {},
          });
          dependency_manager.graph.addNode(gateway);
          dependency_manager.graph.addEdge(new IngressEdge(gateway.ref, svc_node.ref, env_svc_cfg.ingress.subdomain));
        }
      }
    }

    // We resolve these after the loop to ensure that explicitly cited service configs take precedence
    await Promise.all(dependency_resolvers.map(fn => fn()));
    dependency_manager.loadSubscriptions();
    dependency_manager.loadParameters();
    return dependency_manager;
  }

  /**
   * @override
   */
  protected async getServicePort(starting_port?: number): Promise<number> {
    return PortUtil.getAvailablePort(starting_port);
  }

  async loadLocalService(service_path: string): Promise<ServiceNode> {
    const config = ServiceConfigBuilder.buildFromPath(service_path);

    if (this.graph.nodes_map.has(`${config.getName()}:latest`)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.graph.nodes_map.get(`${config.getName()}:latest`)! as ServiceNode;
    }

    const env_service = this.environment.getServiceDetails(`${config.getName()}:latest`);
    const configPort = config.getPort();
    const node = new LocalServiceNode({
      service_path: service_path.endsWith('.json') ? path.dirname(service_path) : service_path,
      service_config: config,
      image: config.getImage(),
      tag: 'latest',
      ports: {
        target: env_service?.port ? env_service.port : (configPort ? configPort : 8080),
        expose: await this.getServicePort(),
      },
      parameters: await this.getParamValues(
        `${config.getName()}:latest`,
        config.getParameters(),
      ),
      env_volumes: this.environment.getOverrideVolumes(`${config.getName()}:latest`),
    });

    this.graph.addNode(node);
    return node;
  }

  /**
   * @override
   */
  async loadDependencies(parent_node: ServiceNode, recursive = true) {
    if (parent_node instanceof ExternalNode) { return; }

    const dependency_resolvers = [];
    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      const env_services = this.environment.getServiceDetails(`${dep_name}:${dep_id}`);
      if (env_services?.host && env_services?.port) {
        await this.loadExternalService(env_services, `${dep_name}:${dep_id}`);
      } else {
        let dep_node: ServiceNode;
        if (env_services?.debug?.path) {
          const svc_path = path.join(path.dirname(this.config_path), env_services.debug.path);
          dep_node = await this.loadLocalService(svc_path);
        } else if (this.linked_services.hasOwnProperty(dep_name)) {
          console.log(`Using locally linked ${chalk.blue(dep_name)} found at ${chalk.blue(this.linked_services[dep_name])}`);
          dep_node = await this.loadLocalService(this.linked_services[dep_name]);
        } else {
          dep_node = await this.loadService(dep_name, dep_id);
        }

        this.graph.addNode(dep_node);
        const edge = new ServiceEdge(parent_node.ref, dep_node.ref);
        this.graph.addEdge(edge);

        if (recursive) {
          await this.loadDatastores(dep_node);
          dependency_resolvers.push(() => this.loadDependencies(dep_node));
        }
      }
    }

    await Promise.all(dependency_resolvers.map(fn => fn()));
  }

  /**
   * @override
   */
  async loadService(service_name: string, service_tag: string): Promise<ServiceNode> {
    const [account_name, svc_name] = service_name.split('/');
    const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${svc_name}/versions/${service_tag}`);

    const config = ServiceConfigBuilder.buildFromJSON(service_digest.config);
    const node = new ServiceNode({
      service_config: config,
      tag: service_digest.tag,
      image: service_digest.service.url.replace(/(^\w+:|^)\/\//, ''),
      ports: {
        target: config.getPort() || 8080,
        expose: await this.getServicePort(),
      },
      parameters: await this.getParamValues(
        `${config.getName()}:${service_digest.tag}`,
        config.getParameters(),
      ),
      env_volumes: this.environment.getOverrideVolumes(`${config.getName()}:${service_tag}`),
    });
    this.graph.addNode(node);
    return node;
  }

  protected loadParameters() {
    for (const node of this.graph.nodes) {
      for (const [key, value] of Object.entries(node.parameters)) {
        // Only include in cli since it will read files off disk
        node.parameters[key] = readIfFile(value);
      }
    }
    super.loadParameters();
  }
}
