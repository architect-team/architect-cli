import { AxiosInstance } from 'axios';
import path from 'path';
import DependencyManager, { DependencyNode, EnvironmentConfigBuilder, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import { DatastoreValueFromParameter, ValueFromParameter } from '../../dependency-manager/src/manager';
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

    // find param that has valuefrom as key
    // recurse to dependencies from this.graph to find an actual value that isn't valuefrom, and set to env_params

    //console.log(dependency_manager.graph.nodes)
    dependency_manager.graph.nodes.forEach(node => {
      for (const [param_name, param_value] of Object.entries(node.parameters)) {
        const valueFromParam = param_value as ValueFromParameter;
        const datastoreValueFromParam = param_value as DatastoreValueFromParameter;
        if (typeof param_value === 'string' && param_value.indexOf('$') > -1) { // param from current service
          node.parameters[param_name] = param_value.replace(/\$HOST/g, node.normalized_ref);
          node.parameters[param_name] = node.parameters[param_name].toString().replace(/\$PORT/g, node.ports.target.toString());
        } else if (typeof param_value === 'object' && valueFromParam.valueFrom?.dependency) { // param from a parent service
          const dependency = dependency_manager.graph.nodes.get(valueFromParam.valueFrom.dependency);
          if (!dependency) {
            throw new Error(`Dependency ${valueFromParam.valueFrom.dependency} does not exist.`);
          }
          node.parameters[param_name] = param_value.valueFrom.value.replace(/\$HOST/g, dependency.normalized_ref);
          node.parameters[param_name] = node.parameters[param_name].toString().replace(/\$PORT/g, dependency.ports.target.toString());
        } else if (typeof param_value === 'object' && datastoreValueFromParam.valueFrom?.datastore) { // param from datastore
          const datastore = dependency_manager.graph.nodes.get(`${node.name}:${node.tag}.${datastoreValueFromParam.valueFrom.datastore}`);
          if (!datastore) {
            throw new Error(`Dependency ${valueFromParam.valueFrom.dependency} does not exist.`);
          }
          node.parameters[param_name] = param_value.valueFrom.value.replace(/\$HOST/g, datastore.normalized_ref);
          node.parameters[param_name] = node.parameters[param_name].toString().replace(/\$PORT/g, datastore.ports.target.toString());
        }
      }
      console.log(node.parameters)
    });


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
