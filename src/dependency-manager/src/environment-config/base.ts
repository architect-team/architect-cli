import { classToClass, plainToClassFromExist } from 'class-transformer';
import { InterfaceSpec } from '..';
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

// TODO investigate extending ComponentConfig
export abstract class EnvironmentConfig extends BaseSpec {
  abstract __version?: string;
  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract setParameter(key: string, value: any): void;
  abstract getVaults(): Dictionary<EnvironmentVault>;
  abstract getComponents(): Dictionary<ComponentConfig>;
  abstract setComponent(key: string, value: ComponentConfig | string): void;
  abstract getDnsConfig(): DnsConfig;
  abstract getInterfaces(): Dictionary<InterfaceSpec>;
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

  copy() {
    return classToClass(this);
  }

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

  merge(other_environment: EnvironmentConfig): EnvironmentConfig {
    return plainToClassFromExist(this.expand(), other_environment.expand());
  }
}
