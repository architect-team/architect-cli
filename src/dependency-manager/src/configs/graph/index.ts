import { BaseEnvironmentConfig } from '../base-configs/environment-config';
import { BaseServiceConfig } from '../base-configs/service-config';
import { EnvironmentBuilder } from '../environment.builder';
import { ServiceBuilder } from '../service.builder';

class GraphNotBuiltError extends Error {
  message = 'Please build and validate the graph before applying changes';
}

export class EnvironmentGraph {
  private _base_config!: BaseEnvironmentConfig;
  private _enriched_config?: BaseEnvironmentConfig;

  constructor(config: BaseEnvironmentConfig) {
    this._base_config = config;
  }

  private async loadAndEnrichServices(
    services: Array<BaseServiceConfig>,
    getConfigByRef: (ref: string) => Promise<BaseServiceConfig>,
    nodes_already_hit: string[] = [],
  ) {
    if (!this._enriched_config) {
      this._enriched_config = EnvironmentBuilder.create();
    }

    for (const service of services) {
      if (nodes_already_hit.includes(service.getName())) {
        continue;
      }

      const current_services = this._enriched_config.getServices() || new Array<BaseServiceConfig>();

      // Get the config from the registry and merge it with any local settings
      let config = ServiceBuilder.create();
      try {
        config = await getConfigByRef(service.getNormalizedRef());
      } catch { }
      config.merge(service);
      
      // Check if we've previously asserted the same config and merge in its values if so
      const existing_config_index = current_services.findIndex(config => config.getNormalizedRef() === service.getNormalizedRef());
      if (existing_config_index >= 0) {
        config.merge(current_services[existing_config_index]);
        current_services.splice(existing_config_index, 1);
      }

      // Add the newly enriched config to the built services list
      current_services.push(config);
      this._enriched_config.setServices(current_services);
      nodes_already_hit.push(config.getName());

      // Recurse through dependencies
      await this.loadAndEnrichServices(config.getDependencies(), getConfigByRef, nodes_already_hit);
    }
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
   * Build out the enriched environment config from the base config to prep
   * for deployment
   * @param getConfigByRef [(ref: string) => Promise<BaseServiceConfig>] A function that returns a config matching a ref
   */
  async build(
    getConfigByRef: (ref: string) => Promise<BaseServiceConfig>,
  ) {
    if (!this._enriched_config) {
      this._enriched_config = EnvironmentBuilder.create();
      await this.loadAndEnrichServices(this._base_config.getServices(), getConfigByRef);
    }
  }

  getServices() {
    if (!this._enriched_config) {
      throw new GraphNotBuiltError();
    }

    return this._enriched_config.getServices();
  }

  addService(service: BaseServiceConfig) {
    if (!this._enriched_config) {
      throw new GraphNotBuiltError();
    }

    this._enriched_config.addService(service);
    this._base_config.addService(service);
  }
}