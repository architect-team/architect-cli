import { InterfaceSpec } from '..';
import { ComponentConfig, ParameterDefinitionSpec, ParameterValueSpec } from '../component-config/base';
import { ConfigSpec } from '../utils/base-spec';
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

// TODO investigate extending ComponentConfig
export abstract class EnvironmentConfig extends ConfigSpec {
  abstract __version?: string;
  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract setParameters(value: Dictionary<ParameterValueSpec>): void;
  abstract setParameter(key: string, value: ParameterValueSpec): void;

  abstract getVaults(): Dictionary<EnvironmentVault>;

  abstract getComponents(): Dictionary<ComponentConfig>;
  abstract setComponents(value: Dictionary<ComponentConfig | string>): void;
  abstract setComponent(key: string, value: ComponentConfig | string): void;

  abstract getDnsConfig(): DnsConfig;

  abstract getInterfaces(): Dictionary<InterfaceSpec>;
  abstract setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  abstract setInterface(key: string, value: InterfaceSpec | string): void;

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

  /** @return New expanded copy of the current config */
  expand() {
    const config = this.copy();
    for (const [key, value] of Object.entries(this.getParameters())) {
      config.setParameter(key, value);
    }
    for (const [key, value] of Object.entries(this.getComponents())) {
      config.setComponent(key, value.expand());
    }
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }
    return config;
  }
}
