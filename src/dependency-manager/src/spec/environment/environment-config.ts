import { Dictionary } from '../../utils/dictionary';
import { BaseConfig } from '../base-spec';
import { InterfaceSpec } from '../common/interface-spec';
import { ParameterDefinitionSpec, ParameterValueSpec } from '../common/parameter-spec';
import { ComponentConfig } from '../component/component-config';

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
export abstract class EnvironmentConfig extends BaseConfig {
  abstract __version?: string;
  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract setParameters(value: Dictionary<ParameterValueSpec>): void;
  abstract setParameter(key: string, value: ParameterValueSpec): void;

  abstract getVaults(): Dictionary<EnvironmentVault>;
  abstract setVaults(value: Dictionary<EnvironmentVault>): void;
  abstract setVault(key: string, value: EnvironmentVault): void;

  abstract getComponents(): Dictionary<ComponentConfig>;
  abstract setComponents(value: Dictionary<ComponentConfig | string>): void;
  abstract setComponent(key: string, value: ComponentConfig | string): void;

  abstract getDnsConfig(): DnsConfig;

  abstract getInterfaces(): Dictionary<InterfaceSpec>;
  abstract setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  abstract setInterface(key: string, value: InterfaceSpec | string): void;

  abstract getContext(): any;

  getComponentByServiceOrTaskRef(ref: string): ComponentConfig | undefined {
    const tag = ref.split(':')[1] || 'latest';
    for (const component of Object.values(this.getComponents())) {
      const component_tag = component.getRef().split(':')[1] || 'latest';
      if (ref.startsWith(`${component.getName()}/`) && tag === component_tag) {
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
