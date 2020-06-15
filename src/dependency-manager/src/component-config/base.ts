import { classToClass, plainToClassFromExist } from 'class-transformer';
import { ServiceConfig } from '../service-config/base';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

export interface ParameterDefinitionSpec {
  required?: boolean;
  description?: string;
  default?: string | number | boolean;
}

export abstract class ComponentConfig extends BaseSpec {
  abstract __version: string;

  abstract getName(): string;
  abstract getRef(): string;
  abstract getExtends(): string | undefined;
  abstract setExtends(ext: string): void;
  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract getServices(): Dictionary<ServiceConfig>;
  abstract getDependencies(): Dictionary<string>;
  abstract getContext(): any;

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

  copy() {
    return classToClass(this);
  }

  merge(other_config: ComponentConfig): ComponentConfig {
    return plainToClassFromExist(this.copy(), other_config);
  }
}
