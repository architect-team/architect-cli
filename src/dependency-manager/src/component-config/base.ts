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
  abstract getContext(): any;

  copy() {
    return classToClass(this);
  }

  merge(other_config: ComponentConfig): ComponentConfig {
    return plainToClassFromExist(this.copy(), other_config);
  }
}
