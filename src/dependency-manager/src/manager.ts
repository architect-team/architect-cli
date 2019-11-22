import fs from 'fs-extra';
import untildify from 'untildify';
import { AxiosInstance } from 'axios';

import DependencyGraph from './graph';
import { EnvironmentConfig } from './environment-config/base';
import MissingRequiredParamError from './missing-required-param-error';
import { ServiceNode } from './graph/node/service';
import { DependencyNode } from './graph/node';
import { ServiceConfig, ServiceParameter } from './service-config/base';
import { DatastoreNode } from './graph/node/datastore';
import { ServiceConfigBuilder } from './service-config/builder';

export default class DependencyManager {
  api: AxiosInstance;
  graph: DependencyGraph = new DependencyGraph();
  environment: EnvironmentConfig;

  constructor(api: AxiosInstance, environment_config: EnvironmentConfig) {
    this.api = api;
    this.environment = environment_config;
  }

  static async create(api: AxiosInstance, env_config: EnvironmentConfig): Promise<DependencyManager> {
    const dependency_manager = new DependencyManager(api, env_config);

    for (const ref of Object.keys(env_config.getServices())) {
      const [name, tag] = ref.split(':');
      const [svc_node, svc_cfg] = await dependency_manager.loadService(name, tag);
      await dependency_manager.loadDependencies(svc_node, svc_cfg);
      await dependency_manager.loadDatastores(svc_node, svc_cfg);
    }

    return dependency_manager;
  }

  /**
   * Parse the parameter values by comparing defaults for a service to
   * values in the environment configuration.
   */
  protected getParamValues(
    service_ref: string,
    parameters: { [key: string]: ServiceParameter },
    datastore_key?: string,
  ): { [key: string]: string | number } {
    let services = this.environment.getServices();

    let env_params: { [key: string]: string | number } = {};
    if (services[service_ref] && datastore_key && services[service_ref].datastores[datastore_key]) {
      env_params = services[service_ref].datastores[datastore_key].parameters;
    } else if (services[service_ref]) {
      env_params = services[service_ref].parameters;
    }

    return Object.keys(parameters).reduce(
      (params: { [s: string]: string | number }, key: string) => {
        const service_param = parameters[key];
        if (service_param.required && !env_params[key]) {
          throw new MissingRequiredParamError(key, service_param.description, service_ref);
        }

        let val = env_params[key] || service_param.default || '';
        if (typeof val !== 'string') {
          val = val.toString();
        }

        if (val.startsWith('file:')) {
          val = fs.readFileSync(untildify(val.slice('file:'.length)), 'utf-8');
        }
        params[key] = val;
        service_param.aliases.forEach(alias => {
          params[alias] = val;
        });
        return params;
      }, {});
  }

  /**
   * Returns a port available for a service to run on. Primary use-case is to be
   * extended by the CLI to return a dynamic available port.
   */
  protected async getServicePort(): Promise<number> {
    return Promise.resolve(80);
  }

  /**
   * Similar to `loadDependencies()`, but iterates over the datastores instead
   */
  protected async loadDatastores(parent_node: DependencyNode, parent_config: ServiceConfig) {
    for (const [ds_name, ds_config] of Object.entries(parent_config.getDatastores())) {
      const image_parts = ds_config.docker.image.split(':');
      const dep_node = new DatastoreNode({
        name: `${parent_node.name}.${parent_node.tag}.${ds_name}`,
        image: ds_config.docker.image,
        tag: image_parts[image_parts.length - 1],
        ports: {
          target: ds_config.docker.target_port,
          expose: await this.getServicePort(),
        },
        parameters: this.getParamValues(
          `${parent_config.getName()}:${parent_node.tag}`,
          ds_config.parameters,
          ds_name,
        ),
      });
      this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
    }
  }

  /**
   * Queries the API to create a node and config object for a service based on
   * its name and tag
   */
  async loadService(service_name: string, service_tag: string): Promise<[DependencyNode, ServiceConfig]> {
    const { data: service } = await this.api.get(`/services/${service_name}`);
    const { data: tag } = await this.api.get(`/services/${service.name}/versions/${service_tag}`);

    const config = ServiceConfigBuilder.buildFromJSON(tag.config);
    const node = new ServiceNode({
      name: tag.name,
      tag: tag.tag,
      image: service.url.replace(/(^\w+:|^)\/\//, ''),
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api: config.getApiSpec(),
      subscriptions: config.getSubscriptions(),
      parameters: this.getParamValues(
        `${config.getName()}:${tag.tag}`,
        config.getParameters(),
      ),
    });

    this.graph.addNode(node);
    return [node, config];
  }

  /**
   * Load the dependency graph with nodes and edges associated with a services
   * dependencies and datastores
   */
  async loadDependencies(parent_node: DependencyNode, parent_config: ServiceConfig) {
    for (const [dep_name, dep_id] of Object.entries(parent_config.getDependencies())) {
      // eslint-disable-next-line prefer-const
      let [dep_node, dep_config] = await this.loadService(dep_name, dep_id);
      dep_node = this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
      await this.loadDependencies(dep_node, dep_config);
      await this.loadDatastores(dep_node, dep_config);
    }
  }
}
