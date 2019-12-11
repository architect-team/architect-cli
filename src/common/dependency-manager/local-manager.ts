import { AxiosInstance } from 'axios';
import dotenvExpand from 'dotenv-expand';
import path from 'path';
import DependencyManager, { DatastoreNode, DependencyNode, EnvironmentConfigBuilder, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import PortUtil from '../utils/port';
import { LocalServiceNode } from './local-service-node';


export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  config_path: string;

  constructor(api: AxiosInstance, config_path?: string) {
    const env_config = config_path
      ? EnvironmentConfigBuilder.buildFromPath(config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});
    super(env_config);
    this.api = api;
    this.config_path = config_path || '';
  }

  protected static loadParameters(dependency_manager: DependencyManager) {
    const env_params_to_expand: { [key: string]: string } = {};
    dependency_manager.graph.nodes.forEach(node => {
      env_params_to_expand[`${node.normalized_ref.toUpperCase()}_HOST`.replace(/[.-]/g, '_')] = node.normalized_ref;
      env_params_to_expand[`${node.normalized_ref.toUpperCase()}_PORT`.replace(/[.-]/g, '_')] = node.ports.target.toString();
      for (const [param_name, param_value] of Object.entries(node.parameters || {})) {
        if (typeof param_value === 'string') {
          env_params_to_expand[`${node.normalized_ref.toUpperCase()}_${param_name}`.replace(/[.-]/g, '_')] = param_value;
        }
      }
      for (const [param_name, param_value] of Object.entries(node.service_config.getParameters())) {
        if ((node instanceof LocalServiceNode || node instanceof ServiceNode) && param_value.default instanceof Object && param_value.default?.valueFrom) {
          const param_target_service_name = param_value.default.valueFrom.dependency;
          const param_target_datastore_name = param_value.default.valueFrom.datastore;
          if (param_target_service_name) {
            const param_target_service = dependency_manager.graph.nodes.get(param_target_service_name);
            if (!param_target_service) {
              throw new Error(`Service ${param_target_service_name} not found for config of ${node.name}`);
            }
            env_params_to_expand[`${node.normalized_ref.toUpperCase()}_${param_name}`.replace(/[.-]/g, '_')] =
              param_value.default.valueFrom.value.replace(/\$/g, `$${param_target_service.normalized_ref.toUpperCase()}_`).replace(/[.-]/g, '_');
          } else if (param_target_datastore_name) {
            const param_target_datastore = dependency_manager.graph.edges.filter(edge => edge.from.name === node.name && (edge.to as DatastoreNode).key === param_target_datastore_name);
            if (!param_target_datastore.length) {
              throw new Error(`Datastore ${param_target_datastore_name} not found for service ${node.name}`);
            }
            env_params_to_expand[`${param_target_datastore_name}.${node.normalized_ref}.${param_name}`.toUpperCase().replace(/[.-]/g, '_')] =
              param_value.default.valueFrom.value.replace(/\$/g, `$${node.normalized_ref}.${param_target_datastore_name}_`.toUpperCase()).replace(/[.-]/g, '_');
          }
        }
      }
    });

    const expanded_params = dotenvExpand({ parsed: env_params_to_expand }).parsed;
    dependency_manager.graph.nodes.forEach(node => {
      const service_name = node.normalized_ref;
      const service_prefix = service_name.replace(/[^\w\s]/gi, '_').toUpperCase();
      const written_env_keys = [];

      // map datastore params
      const service_datastore_edges = dependency_manager.graph.edges.filter(edge => edge.from.normalized_ref === service_name && edge.to instanceof DatastoreNode);
      for (const edge of service_datastore_edges) {
        const datastore_prefix = `${(edge.to as DatastoreNode).key}_${service_prefix}`.toUpperCase();
        const service_datastore_params = Object.entries(expanded_params || {})
          .filter(([key, _]) => key.startsWith(datastore_prefix));
        for (const [param_name, param_value] of service_datastore_params) {
          const real_param_name = param_name.replace(`${datastore_prefix}_`, '');
          node.parameters[real_param_name] = param_value;
          written_env_keys.push(param_name.replace(`${datastore_prefix}_`, ''));
        }
      }

      // map service params
      const service_params = Object.entries(expanded_params || {})
        .filter(([key, _]) => key.startsWith(service_prefix));

      for (const [param_name, param_value] of service_params) {
        const real_param_name = param_name.replace(`${service_prefix}_`, '');
        if (!written_env_keys.find(key => key === real_param_name) && real_param_name !== 'ARCHITECT') {
          node.parameters[real_param_name] = param_value;
        }
      }
    });
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path);

    const dependency_resolvers = [];
    for (const [ref, env_svc_cfg] of Object.entries(dependency_manager.environment.getServices())) {
      let svc_node: DependencyNode;

      if (env_svc_cfg.debug) {
        const svc_path = path.join(path.dirname(env_config_path), env_svc_cfg.debug.path);
        svc_node = await dependency_manager.loadLocalService(svc_path);
      } else {
        const [name, tag] = ref.split(':');
        svc_node = await dependency_manager.loadService(name, tag);
      }

      await dependency_manager.loadDatastores(svc_node);
      dependency_resolvers.push(() => dependency_manager.loadDependencies(svc_node));
    }

    // We resolve these after the loop to ensure that explicitly cited service configs take precedence
    await Promise.all(dependency_resolvers.map(fn => fn()));
    dependency_manager.loadSubscriptions();
    this.loadParameters(dependency_manager);

    return dependency_manager;
  }

  /**
   * @override
   */
  protected async getServicePort(): Promise<number> {
    return PortUtil.getAvailablePort();
  }

  async loadLocalService(service_path: string): Promise<DependencyNode> {
    const config = ServiceConfigBuilder.buildFromPath(service_path);

    if (this.graph.nodes.has(`${config.getName()}:latest`)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.graph.nodes.get(`${config.getName()}:latest`)!;
    }

    let node = new LocalServiceNode({
      service_path: service_path,
      service_config: config,
      tag: 'latest',
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api: config.getApiSpec(),
      parameters: await this.getParamValues(
        `${config.getName()}:latest`,
        config.getParameters(),
      ),
    });

    if (config.getDebugOptions()) {
      node.command = config.getDebugOptions()?.command;
    }

    node = this.graph.addNode(node) as LocalServiceNode;
    return node;
  }

  /**
   * @override
   */
  async loadDependencies(parent_node: DependencyNode, recursive = true) {
    const dependency_resolvers = [];
    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      let dep_node: DependencyNode;

      const env_services = this.environment.getServiceDetails(`${dep_name}:${dep_id}`);
      if (env_services && env_services.debug) {
        const svc_path = path.join(path.dirname(this.config_path), env_services.debug.path);
        dep_node = await this.loadLocalService(svc_path);
      } else {
        dep_node = await this.loadService(dep_name, dep_id);
      }

      this.graph.addEdge(parent_node, dep_node);
      if (recursive) {
        await this.loadDatastores(dep_node);
        dependency_resolvers.push(() => this.loadDependencies(dep_node));
      }
    }

    await Promise.all(dependency_resolvers.map(fn => fn()));
  }

  /**
   * @override
   */
  async loadService(service_name: string, service_tag: string): Promise<DependencyNode> {
    const { data: service } = await this.api.get(`/services/${service_name}`);
    const { data: tag } = await this.api.get(`/services/${service.name}/versions/${service_tag}`);

    const config = ServiceConfigBuilder.buildFromJSON(tag.config);
    const node = new ServiceNode({
      service_config: config,
      tag: tag.tag,
      image: service.url.replace(/(^\w+:|^)\/\//, ''),
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api: config.getApiSpec(),
      parameters: await this.getParamValues(
        `${config.getName()}:${tag.tag}`,
        config.getParameters(),
      ),
    });

    return this.graph.addNode(node);
  }
}
