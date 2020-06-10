import { classToClass, plainToClassFromExist } from 'class-transformer';
import { ServiceConfig } from '../service-config/base';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { ParameterDefinitionSpecV1 } from '../v1-spec/parameters';

export abstract class ComponentConfig extends BaseSpec {
  abstract __version: string;

  abstract getName(): string;
  abstract getRef(): string;
  abstract getExtends(): string | undefined;
  abstract setExtends(ext: string): void;
  abstract getParameters(): Dictionary<ParameterDefinitionSpecV1>;
  abstract getServices(): Dictionary<ServiceConfig>;
  abstract getDependencies(): Dictionary<string>;

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
