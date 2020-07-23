import { InterfaceSpec, ServiceConfig } from '../service-config/base';
import { ConfigSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

export type ParameterValue = string | number | boolean | undefined;

export interface ParameterDefinitionSpec {
  required?: boolean;
  description?: string;
  default?: ParameterValue;
}

export type ParameterValueSpec = ParameterValue | ParameterDefinitionSpec;

export abstract class ComponentConfig extends ConfigSpec {
  abstract __version?: string;

  abstract getName(): string;
  abstract getRef(): string;
  abstract getExtends(): string | undefined;
  abstract setExtends(ext: string): void;
  abstract getDescription(): string;
  abstract getKeywords(): string[];
  abstract getAuthor(): string;

  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract setParameters(value: Dictionary<ParameterValueSpec>): void;
  abstract setParameter(key: string, value: ParameterValueSpec): void;

  abstract getServices(): Dictionary<ServiceConfig>;
  abstract setServices(value: Dictionary<ServiceConfig>): void;
  abstract setService(key: string, value: ServiceConfig): void;

  abstract getDependencies(): Dictionary<string>;

  abstract getInterfaces(): Dictionary<InterfaceSpec>;
  abstract setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  abstract setInterface(key: string, value: InterfaceSpec | string): void;

  abstract getContext(): any;

  getInterfacesRef() {
    return `${this.getRef()}-interfaces`;
  }

  getComponentVersion() {
    return this.getRef().split(':')[1];
  }

  getServiceRef(service_name: string) {
    return `${this.getName()}/${service_name}:${this.getComponentVersion()}`;
  }

  getServiceByRef(service_ref: string): ServiceConfig | undefined {
    if (service_ref.startsWith(this.getName())) {
      const [service_name, component_tag] = service_ref.substr(this.getName().length + 1).split(':');
      if (component_tag === this.getComponentVersion()) {
        return this.getServices()[service_name];
      }
    }
  }

  /** @return New expanded copy of the current config */
  expand() {
    const config = this.copy();
    for (const [key, value] of Object.entries(this.getParameters())) {
      config.setParameter(key, value);
    }
    for (const [key, value] of Object.entries(this.getServices())) {
      config.setService(key, value.expand());
    }
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }

    return config;
  }
}
