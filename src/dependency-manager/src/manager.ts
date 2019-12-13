import axios from 'axios';
import fs from 'fs-extra';
import * as https from 'https';
import untildify from 'untildify';
import { ServiceNode } from '.';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import DependencyGraph from './graph';
import { DatastoreNode } from './graph/node/datastore';
import { ExternalNode } from './graph/node/external';
import MissingRequiredParamError from './missing-required-param-error';
import { ServiceConfig } from './service-config/base';
import { readIfFile } from './utils/file';
import { DependencyNode } from './graph/node';


interface VaultParameter {
  valueFrom: {
    vault: string;
    key: string;
  };
}

export default abstract class DependencyManager {
  abstract graph: DependencyGraph;
  environment: EnvironmentConfig;

  constructor(environment_config?: EnvironmentConfig) {
    this.environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
  }

  /**
   * Loop through the nodes and enrich the graph with edges between notifiers and subscribers
   */
  protected loadSubscriptions() {
    for (const node of this.graph.nodes) {
      if (node instanceof ServiceNode) {
        for (const svc_name of Object.keys(node.service_config.getSubscriptions())) {
          const ref = Array.from(this.graph.nodes_map.keys()).find(key => key.startsWith(svc_name));

          if (ref && this.graph.nodes_map.has(ref)) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const source = this.graph.nodes_map.get(ref)!;
            this.graph.addEdge(source, node, 'notification');
          }
        }
      }
    }
  }

  /**
   * Parse the parameter values by comparing defaults for a service to
   * values in the environment configuration.
   */
  protected async getParamValues(
    service_config: ServiceConfig,
    tag_name: string,
    datastore_key?: string,
  ): Promise<{ [key: string]: string | number }> {
    const service_ref = `${service_config.getName()}:${tag_name}`;
    const parameters = datastore_key ? service_config.getDatastores()[datastore_key].parameters : service_config.getParameters();
    const services = this.environment.getServices();

    let raw_params: { [key: string]: string | number | VaultParameter } = {};
    if (datastore_key && services[service_ref] && services[service_ref].datastores[datastore_key]) {
      raw_params = services[service_ref].datastores[datastore_key].parameters || {};
    } else if (services[service_ref]) {
      raw_params = services[service_ref].parameters || {};
    }

    // Enrich vault parameters
    const env_params = new Map<string, string | number>();
    for (const [key, data] of Object.entries(raw_params)) {
      if (typeof data !== 'object') {
        env_params.set(key, data);
        continue;
      }

      const param = data as VaultParameter;
      const vaults = this.environment.getVaults();
      const param_vault = vaults[param.valueFrom.vault];
      const vault_client = axios.create({
        baseURL: param_vault.host,
        headers: {
          'X-Vault-Token': readIfFile(param_vault.access_token),
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
        }),
      });

      const param_start = param.valueFrom.key.lastIndexOf('/');
      const param_key = param.valueFrom.key.substr(0, param_start);
      const param_name = param.valueFrom.key.substr(param_start + 1);
      try {
        const res = await vault_client.get(`v1/${param_key}/data/${param_name}`);
        env_params.set(key, res.data.data.data[param_name]);
      } catch (err) {
        throw new Error(`Error retrieving secret ${data.valueFrom.key}`);
      }
    }

    return Object.keys(parameters).reduce(
      (params: { [s: string]: string | number }, key: string) => {
        const service_param = parameters[key];
        if (service_param.required && !env_params.has(key)) {
          throw new MissingRequiredParamError(key, service_param.description, service_ref);
        }

        let val = env_params.get(key) || '';
        if (typeof service_param.default === 'object') {
          let dep_node: DependencyNode;
          if (service_param.default.valueFrom.dependency) {
            if (!Object.keys(service_config.getDependencies()).includes(service_param.default.valueFrom.dependency)) {
              throw new Error(`Invalid parameter/dependency relationship(s) for service ${service_ref}`);
            }

            dep_node = this.graph.getNodeByRef(service_param.default.valueFrom.dependency);
          } else {
            if (!Object.keys(service_config.getDatastores()).includes(service_param.default.valueFrom.datastore!)) {
              throw new Error(`Invalid parameter/datastore relationship(s) for service ${service_ref}`);
            }

            dep_node = this.graph.getNodeByRef(`${service_ref}.${service_param.default.valueFrom.datastore}`);
          }

          val = service_param.default.valueFrom.value;
          for (const [dep_key, dep_val] of Object.entries(dep_node.parameters)) {
            const regex = new RegExp(`(.?\${?${dep_key}}?)`, 'g');
            val = val.replace(regex, dep_val.toString());
          }
        } else if (service_param.default) {
          val = service_param.default;
        }

        if (typeof val === 'number') {
          val = val.toString();
        }

        if (typeof val === 'string' && val.startsWith('file:')) {
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
  protected async loadDatastores(parent_node: ServiceNode) {
    for (const [ds_name, ds_config] of Object.entries(parent_node.service_config.getDatastores())) {
      const dep_node_config = {
        parent_ref: parent_node.ref,
        key: ds_name,
        parameters: await this.getParamValues(
          parent_node.service_config,
          parent_node.tag,
          ds_name,
        ),
      };
      const environment_service_config = this.environment.getServices()[parent_node.ref];
      let dep_node;

      if (environment_service_config?.datastores[ds_name]?.host) {
        const external_port = environment_service_config?.datastores[ds_name]?.port || ds_config.docker.target_port;
        dep_node = new ExternalNode({
          ...dep_node_config,
          host: environment_service_config.datastores[ds_name].host!,
          ports: {
            target: external_port,
            expose: external_port,
          },
        });
      } else {
        dep_node = new DatastoreNode({
          ...dep_node_config,
          image: ds_config.docker.image,
          ports: {
            target: ds_config.docker.target_port,
            expose: await this.getServicePort(),
          },
        });
      }

      this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
    }
  }

  /**
   * Load the dependency graph with nodes and edges associated with a services
   * dependencies and datastores
   */
  async loadDependencies(parent_node: ServiceNode) {
    const dependency_promises = [];
    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      const dep_node = await this.loadService(dep_name, dep_id);
      this.graph.addNode(dep_node);
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
  abstract async loadService(service_name: string, service_tag: string): Promise<ServiceNode>;
}
