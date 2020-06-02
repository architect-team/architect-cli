import { classToClass, plainToClassFromExist } from 'class-transformer';
import { ParameterValueV2, ServiceConfig } from '../service-config/base';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

export abstract class ComponentConfig extends BaseSpec {
  abstract __version: string;

  abstract getName(): string;
  abstract getExtends(): string | undefined;
  abstract setExtends(ext: string): void;
  abstract getParameters(): Dictionary<ParameterValueV2>;
  abstract getServices(): Dictionary<ServiceConfig>;

  copy() {
    return classToClass(this);
  }

  merge(other_config: ComponentConfig): ComponentConfig {
    return plainToClassFromExist(this.copy(), other_config);
  }
}
