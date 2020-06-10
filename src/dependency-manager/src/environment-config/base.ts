import { ComponentConfig } from '../component-config/base';
import { ParameterValue } from '../service-config/base';
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
  abstract getParameters(): Dictionary<ParameterValue>;
  abstract getVaults(): Dictionary<EnvironmentVault>;
  abstract getComponents(): Dictionary<ComponentConfig>;
  abstract getDnsConfig(): DnsConfig;

  getComponentByServiceRef(service_ref: string): ComponentConfig | undefined {
    for (const component of Object.values(this.getComponents())) {
      if (component.getServiceByRef(service_ref)) {
        return component;
      }
    }
  }
}
