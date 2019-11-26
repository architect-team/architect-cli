import fs from 'fs-extra';
import untildify from 'untildify';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import DependencyGraph from './graph';
import { DependencyNode } from './graph/node';
import { DatastoreNode } from './graph/node/datastore';
import MissingRequiredParamError from './missing-required-param-error';
import { ServiceParameter } from './service-config/base';


export default abstract class DependencyManager {
  graph: DependencyGraph = new DependencyGraph();
  environment: EnvironmentConfig;

  constructor(environment_config?: EnvironmentConfig) {
    this.environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
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
    const services = this.environment.getServices();

    let env_params: { [key: string]: string | number } = {};
    if (datastore_key && services[service_ref] && services[service_ref].datastores[datastore_key]) {
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
  protected async loadDatastores(parent_node: DependencyNode) {
    for (const [ds_name, ds_config] of Object.entries(parent_node.service_config.getDatastores())) {
      const dep_node = new DatastoreNode({
        key: ds_name,
        service_config: parent_node.service_config,
        image: ds_config.docker.image,
        tag: parent_node.tag,
        ports: {
          target: ds_config.docker.target_port,
          expose: await this.getServicePort(),
        },
        parameters: this.getParamValues(
          parent_node.ref,
          ds_config.parameters,
          ds_name,
        ),
      });
      this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
    }
  }

  /**
   * Load the dependency graph with nodes and edges associated with a services
   * dependencies and datastores
   */
  async loadDependencies(parent_node: DependencyNode) {
    const dependency_promises = [];
    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      // eslint-disable-next-line prefer-const
      let dep_node = await this.loadService(dep_name, dep_id);
      dep_node = this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
      await this.loadDatastores(dep_node);
      dependency_promises.push(() => this.loadDependencies(dep_node));
    }

    await Promise.all(dependency_promises.map(fn => fn()));
  }

  /**
   * Queries the API to create a node and config object for a service based on
   * its name and tag
   */
  abstract async loadService(service_name: string, service_tag: string): Promise<DependencyNode>;
}
