import fs from 'fs-extra';
import untildify from 'untildify';
import { AxiosInstance } from 'axios';
import { plainToClass } from 'class-transformer';

import DependencyGraph from './graph';
import EnvironmentConfig from './environment-config';
import ServiceParameter from './service-config/parameter';
import MissingRequiredParamError from './missing-required-param-error';
import { ServiceConfigV1 } from './service-config/v1';
import { ServiceNode } from './graph/node/service';
import { DependencyNode } from './graph/node';
import { ServiceConfig } from './service-config';
import { DatastoreNode } from './graph/node/datastore';

export default class DependencyManager {
  api: AxiosInstance;
  graph: DependencyGraph = new DependencyGraph();
  environment: EnvironmentConfig;

  constructor(api: AxiosInstance, environment_config: EnvironmentConfig) {
    this.api = api;
    this.environment = environment_config;
  }

  /**
   * Parse the parameter values by comparing defaults for a service to
   * values in the environment configuration.
   */
  private getParamValues(
    service_ref: string,
    parameters: { [key: string]: ServiceParameter },
    datastore_key?: string,
  ): { [key: string]: string | number } {
    let env_params = this.environment.getServiceParameters(service_ref);
    if (datastore_key) {
      env_params = this.environment.getDatastoreParameters(service_ref, datastore_key);
    }

    return Object.keys(parameters).reduce(
      (params: { [s: string]: string | number }, key: string) => {
        const service_param = parameters[key];
        if (service_param.isRequired() && !env_params[key]) {
          throw new MissingRequiredParamError(key, service_param.getDescription(), service_ref);
        }

        let val = env_params[key] || service_param.getDefaultValue() || '';
        if (typeof val !== 'string') {
          val = val.toString();
        }

        if (val.startsWith('file:')) {
          val = fs.readFileSync(untildify(val.slice('file:'.length)), 'utf-8');
        }
        params[key] = val;
        service_param.getAliases().forEach(alias => {
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
      const docker_config = ds_config.getDockerConfig();
      const image_parts = docker_config.image.split(':');
      const dep_node = new DatastoreNode({
        name: `${parent_config.getName()}.${ds_name}`,
        image: docker_config.image,
        tag: image_parts[image_parts.length - 1],
        ports: {
          target: docker_config.target_port,
          expose: await this.getServicePort(),
        },
        parameters: this.getParamValues(
          `${parent_config.getName()}:${parent_node.tag}`,
          parent_config.getParameters(),
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

    const config = plainToClass(ServiceConfigV1, tag.config as ServiceConfigV1);
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
      subscriptions: config.subscriptions,
      parameters: this.getParamValues(
        `${config.name}:${tag.tag}`,
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
