/* eslint-disable no-empty */
import { EnvironmentVault } from '../../environment-config/base';
import VaultManager from '../../vault-manager';
import { BaseDnsConfig, BaseEnvironmentConfig } from '../environment-config';
import { EnvironmentBuilder } from '../environment.builder';
import { BaseParameterValueConfig, BaseParameterValueFromConfig, BaseServiceConfig, BaseValueFromDependencyConfig, BaseValueFromVaultConfig } from '../service-config';
import { ServiceBuilder } from '../service.builder';

interface GraphEnrichmentOptions {
  getConfig: (ref: string) => Promise<BaseServiceConfig>;
  getRegistryImage: (ref: string) => string;
  getHostAssignment: (config: BaseServiceConfig, interface_key: string) => Promise<string>;
  getPortAssignment: (config: BaseServiceConfig, interface_key: string) => Promise<number>;
  debug?: boolean;
  skip_nodes?: string[];
}

class GraphNotBuiltError extends Error {
  message = 'Please build and validate the graph before applying changes';
}

class ValueFromDependencyError extends Error {
  constructor(
    service_name: string,
    dependency_name: string,
    parameter_key: string
  ) {
    super();
    this.message = `${service_name} is trying to populate the parameter, ${parameter_key}, from the service ${dependency_name}, but it was not installed as a dependency.`;
  }
}

export class EnvironmentGraph {
  private _is_built = false;
  private _base_config: BaseEnvironmentConfig;
  private _enriched_config: BaseEnvironmentConfig;

  constructor(config: BaseEnvironmentConfig) {
    this._base_config = config;
    this._enriched_config = EnvironmentBuilder.create();
  }

  private async loadParametersForService(
    service: BaseServiceConfig,
  ): Promise<BaseServiceConfig> {
    const current_services = this._enriched_config.getServices() || new Array<BaseServiceConfig>();
    const parameters = service.getParameters();

    // Assign reserved parameters
    const interfaces = service.getInterfaces();
    interfaces.forEach((value, interface_key) => {
      if (!value.host) {
        throw new Error('Missing host assignment for service interface');
      }

      // TODO: Properly assign internal hosts/ports
      const prefix = `${interface_key.toUpperCase()}`;
      parameters.set(`${prefix}_EXTERNAL_HOST`, { default: value.host });
      parameters.set(`${prefix}_INTERNAL_HOST`, { default: value.host });
      parameters.set(`${prefix}_HOST`, { default: value.host });
      parameters.set(`${prefix}_EXTERNAL_PORT`, { default: value.port });
      parameters.set(`${prefix}_INTERNAL_PORT`, { default: value.port });
      parameters.set(`${prefix}_PORT`, { default: value.port });

      if (value.default) {
        parameters.set(`EXTERNAL_HOST`, { default: value.host });
        parameters.set(`INTERNAL_HOST`, { default: value.host });
        parameters.set(`HOST`, { default: value.host });
        parameters.set(`EXTERNAL_PORT`, { default: value.port });
        parameters.set(`INTERNAL_PORT`, { default: value.port });
        parameters.set(`PORT`, { default: value.port });
      }
    });

    let key, value;
    for ([key, value] of parameters) {
      if (value.hasOwnProperty('value_from')) {
        value = value as BaseParameterValueFromConfig;
        if (value.hasOwnProperty('vault')) {
          const value_from = value.value_from as BaseValueFromVaultConfig;

          throw new Error('Havent implemented vault parsing');
        } else {
          const value_from = value.value_from as BaseValueFromDependencyConfig;
          const dependency = current_services.find(dep =>
            dep.getName() === value_from.dependency || dep.getResolvableRef() === value_from.dependency
          );
          if (!dependency) {
            throw new ValueFromDependencyError(service.getName() || '', value_from.dependency, key);
          }

          // Loop through the matching dependency's params and replace references with values
          const dependency_parameters = dependency.getParameters();
          dependency_parameters.forEach((param_value, param_key) => {
            param_value = param_value as BaseParameterValueConfig;
            const regex = new RegExp(`\\$${param_key}`, 'g');
            value_from.value = value_from.value.replace(regex, String(param_value.default));
          });

          value = { default: value_from.value };
        }
      }

      parameters.set(key, value);
    }

    service.setParameters(parameters);
    return service;
  }

  private async buildService(
    service: BaseServiceConfig,
    options: GraphEnrichmentOptions,
  ) {
    const name = service.getName();
    if (name && options.skip_nodes?.includes(name)) {
      return;
    }

    // Get the config from the registry and merge it with any local settings
    let config;
    while (!config) {
      const debug_path = service.getDebugPath();
      if (debug_path) {
        try {
          config = await ServiceBuilder.loadFromFile(debug_path);
        } catch {
          console.log(`Failed to find ${service.getName()} at debug path. Falling back to registry.`);
          service.setDebugPath(undefined);
        }
      } else {
        try {
          config = await options.getConfig(service.getResolvableRef());
        } catch {
          console.log(`Failed to find ${service.getResolvableRef()} in registry. Falling back to in-line config.`);
          config = ServiceBuilder.create();
        }
      }
    }
    config.merge(service);

    // Check if we've previously asserted the same config and merge in its values if so
    const enriched_services = this._enriched_config.getServices();
    const existing_config_index = enriched_services.findIndex(config => config.getResolvableRef() === service.getResolvableRef());
    if (existing_config_index >= 0) {
      config.merge(enriched_services[existing_config_index]);
      enriched_services.splice(existing_config_index, 1);
      this._enriched_config.setServices(enriched_services);
    }

    // Assign hosts/ports to interfaces as needed
    const interfaces = config.getInterfaces();
    for (const [key, value] of interfaces) {
      value.host = value.host || await options.getHostAssignment(config, key);
      value.port = value.port || await options.getPortAssignment(config, key);
      interfaces.set(key, value);
    }
    config.setInterfaces(interfaces);
    this._enriched_config.addService(config);

    // Assert that we've already enriched this service
    options.skip_nodes = options.skip_nodes || [];
    options.skip_nodes.push(config.getName() || '');

    // Recurse through dependencies
    for (const dependency of config.getDependencies()) {
      await this.buildService(dependency, options);
    }

    // Load parameters (must happen after dependencies are loaded so value_from
    // references will work)
    config = await this.loadParametersForService(config);
    this._enriched_config.addService(config);
  }

  private async build(
    options: GraphEnrichmentOptions,
    force_rebuild = false,
  ) {
    if (!this._is_built || force_rebuild) {
      this._enriched_config = EnvironmentBuilder.create();

      options = {
        debug: false,
        ...options,
      };

      for (const service of this._base_config.getServices()) {
        await this.buildService(service, options);
      }

      this._is_built = true;
    }
  }

  /**
   * Build out the enriched environment config from the base config to prep
   * for deployment
   */
  static async build(
    config: BaseEnvironmentConfig,
    options: GraphEnrichmentOptions
  ): Promise<EnvironmentGraph> {
    const graph = new EnvironmentGraph(config);
    await graph.build(options);
    return graph;
  }

  /**
   * Run validation checks on the graph to ensure it has everything it needs
   * in order to be deployed. This should not make network calls and should
   * just check the contents of the _enriched_config
   * @returns boolean
   */
  validate(): boolean {
    throw new Error('Run validation checks');
  }

  /**
   * Retrieve the list of services in the graph. Will throw an error if the full
   * list hasn't been built out
   */
  getServices() {
    if (!this._enriched_config) {
      throw new GraphNotBuiltError();
    }

    return this._enriched_config.getServices();
  }

  /**
   * Add/update a service in the graph with a new config. Will throw an error if
   * the full graph hasn't been built out.
   * @param service [BaseServiceConfig]
   */
  addService(service: BaseServiceConfig) {
    if (!this._enriched_config) {
      throw new GraphNotBuiltError();
    }

    this._enriched_config.addService(service);
    this._base_config.addService(service);
  }

  /**
   * Retrieve the vault instances used to interact with secret managers
   */
  getVaultManager(): VaultManager {
    const vaults = {} as { [key: string]: EnvironmentVault };
    this._enriched_config?.getVaults().forEach((config, key) => {
      vaults[key] = config;
    });
    return new VaultManager(vaults);
  }

  /**
   * Retrieve the DNS configuration settings for the graph
   */
  getDnsConfig(): BaseDnsConfig | undefined {
    return this._enriched_config.getDnsConfig();
  }
}
