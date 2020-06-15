import { ComponentConfig, ParameterDefinitionSpec } from '../component-config/base';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

export interface EnvironmentVault {
  type: string;
  host: string;
  description?: string;
  client_token?: string;
  role_id?: string;
  secret_id?: string;
}

export interface DnsConfig {
  searches?: string | string[];
}

export abstract class EnvironmentConfig extends BaseSpec {
  abstract __version: string;
  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract getVaults(): Dictionary<EnvironmentVault>;
  abstract getComponents(): Dictionary<ComponentConfig>;
  abstract getDnsConfig(): DnsConfig;
  abstract getContext(): any;

  getComponentByServiceRef(service_ref: string): ComponentConfig | undefined {
    const service_tag = service_ref.split(':')[1] || 'latest';
    for (const component of Object.values(this.getComponents())) {
      const component_tag = component.getRef().split(':')[1] || 'latest';
      if (service_ref.startsWith(`${component.getName()}/`) && service_tag === component_tag) {
        return component;
      }
    }
  }
}
