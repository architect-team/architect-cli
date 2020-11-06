import { serialize, Transform } from 'class-transformer';
import { Allow, IsObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { Dictionary } from '../../utils/dictionary';
import { ComponentSlug, ComponentSlugUtils, ComponentVersionSlug, ComponentVersionSlugUtils, Slugs } from '../../utils/slugs';
import { validateCrossDictionaryCollisions, validateDictionary, validateInterpolation } from '../../utils/validation';
import { DictionaryType } from '../../utils/validators/dictionary_type';
import { InterfaceSpec } from '../common/interface-spec';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { ParameterValue } from '../common/parameter-spec';
import { ParameterValueSpecV1 } from '../common/parameter-v1';
import { transformParameters } from '../resource/v1';
import { ServiceConfig } from '../service/base';
import { transformServices } from '../service/transformer';
import { TaskConfig } from '../task/base';
import { transformTasks } from '../task/transformer';
import { ComponentConfig } from './base';
import { transformComponentInterfaces } from './transformer';

interface ServiceContextV1 {
  environment: Dictionary<string>;
  interfaces: Dictionary<InterfaceSpec>;
}

interface TaskContextV1 {
  environment: Dictionary<string>;
}

export interface ComponentContextV1 {
  dependencies: Dictionary<ComponentContextV1>;
  parameters: Dictionary<ParameterValue>;
  interfaces: Dictionary<InterfaceSpec>;
  services: Dictionary<ServiceContextV1>;
  tasks: Dictionary<TaskContextV1>;
}

export class ComponentConfigV1 extends ComponentConfig {
  @Allow({ always: true })
  __version?: string;

  @IsOptional({
    groups: ['operator'],
  })
  @IsString({ always: true })
  @Matches(new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`), {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  @Matches(new RegExp(`^${ComponentSlugUtils.RegexBase}$`), {
    message: 'Names must be prefixed with an account name (e.g. architect/component-name)',
    groups: ['developer'],
  })
  name!: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  @Matches(/^(?!file:).*$/g, { groups: ['developer'], message: 'Cannot hardcode a filesystem location when registering a component' })
  extends?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsString({ each: true, always: true })
  keywords?: string[];

  @IsOptional({ always: true })
  @IsString({ always: true })
  author?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  parameters?: Dictionary<ParameterValueSpecV1>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform((value) => !value ? {} : value)
  services?: Dictionary<ServiceConfig>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform((value) => !value ? {} : value)
  tasks?: Dictionary<TaskConfig>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @DictionaryType('string', { always: true, message: 'dependency versions must be strings' })
  dependencies?: Dictionary<string>;

  @IsOptional({ groups: ['operator', 'debug'] })
  @IsObject({ groups: ['developer'], message: 'interfaces must be defined even if it is empty since the majority of components need to expose services' })
  @Transform((value) => !value ? {} : value)
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  @IsOptional({ always: true })
  @IsString({ always: true })
  artifact_image?: string;

  getName(): ComponentSlug {
    let split;
    try {
      split = ComponentSlugUtils.parse(this.name);
    } catch {
      split = ComponentVersionSlugUtils.parse(this.name);
    }
    return ComponentSlugUtils.build(split.component_account_name, split.component_name);
  }

  getRef(): ComponentVersionSlug {
    let split;
    if (this.extends?.startsWith(`${this.name}:`)) {
      split = ComponentVersionSlugUtils.parse(this.extends);
    } else {
      try {
        split = ComponentSlugUtils.parse(this.name);
      } catch {
        split = ComponentVersionSlugUtils.parse(this.name);
      }
    }
    return ComponentVersionSlugUtils.build(split.component_account_name, split.component_name, split.tag);
  }

  getExtends() {
    return this.extends;
  }

  setExtends(ext: string) {
    this.extends = ext;
  }

  getLocalPath() {
    return this.getExtends()?.startsWith('file:') ? this.getExtends()?.substr('file:'.length) : undefined;
  }

  getDescription() {
    return this.description || '';
  }

  getKeywords() {
    return this.keywords || [];
  }

  getAuthor() {
    return this.author || '';
  }

  getParameters() {
    return transformParameters(this.parameters) || {};
  }

  setParameters(value: Dictionary<ParameterValueSpecV1>) {
    this.parameters = value;
  }

  setParameter(key: string, value: ParameterValueSpecV1) {
    if (!this.parameters) {
      this.parameters = {};
    }
    this.parameters[key] = value;
  }

  getServices() {
    return transformServices(this.services) || {};
  }

  setServices(value: Dictionary<ServiceConfig>) {
    this.services = value;
  }

  setService(key: string, value: ServiceConfig) {
    if (!this.services) {
      this.services = {};
    }
    this.services[key] = value;
  }

  getTasks() {
    return transformTasks(this.tasks) || {};
  }

  setTasks(value: Dictionary<TaskConfig>) {
    this.tasks = value;
  }

  setTask(key: string, value: TaskConfig) {
    if (!this.tasks) {
      this.tasks = {};
    }
    this.tasks[key] = value;
  }

  getDependencies() {
    const output: Dictionary<string> = {};
    for (const [k, v] of Object.entries(this.dependencies || {})) {
      output[k] = `${v}`;
    }
    return output;
  }

  getInterfaces() {
    return transformComponentInterfaces(this.interfaces) || {};
  }

  setInterfaces(value: Dictionary<InterfaceSpecV1 | string>) {
    this.interfaces = value;
  }

  setInterface(key: string, value: InterfaceSpecV1 | string) {
    if (!this.interfaces) {
      this.interfaces = {};
    }
    this.interfaces[key] = value;
  }

  getArtifactImage(): string | undefined {
    return this.artifact_image;
  }

  setArtifactImage(image: string) {
    this.artifact_image = image;
  }

  getContext(): ComponentContextV1 {
    const dependencies: Dictionary<any> = {};
    for (const dk of Object.keys(this.getDependencies())) {
      dependencies[dk] = {};
    }

    const parameters: Dictionary<ParameterValue> = {};
    for (const [pk, pv] of Object.entries(this.getParameters())) {
      parameters[pk] = pv.default === undefined ? '' : pv.default;
    }

    const interface_filler = {
      port: '',
      host: '',
      protocol: '',
      url: '',
    };

    const interfaces: Dictionary<InterfaceSpec> = {};
    for (const [ik, iv] of Object.entries(this.getInterfaces())) {
      interfaces[ik] = {
        ...interface_filler,
        ...iv,
      };
    }

    const services: Dictionary<ServiceContextV1> = {};
    for (const [sk, sv] of Object.entries(this.getServices())) {
      const interfaces: Dictionary<InterfaceSpec> = {};
      for (const [ik, iv] of Object.entries(sv.getInterfaces())) {
        interfaces[ik] = {
          ...interface_filler,
          ...iv,
        };
      }
      services[sk] = {
        interfaces,
        environment: sv.getEnvironmentVariables(),
      };
    }

    const tasks: Dictionary<TaskContextV1> = {};
    for (const [tk, tv] of Object.entries(this.getTasks())) {
      tasks[tk] = {
        environment: tv.getEnvironmentVariables(),
      };
    }

    return {
      dependencies,
      parameters,
      interfaces,
      services,
      tasks,
    };
  }

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateDictionary(expanded, 'parameters', errors, undefined, options, new RegExp(`^${Slugs.ComponentParameterRegexBase}$`));
    errors = await validateDictionary(expanded, 'services', errors, undefined, { ...options, groups: (options.groups || []).concat('component') }, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
    errors = await validateDictionary(expanded, 'tasks', errors, undefined, { ...options, groups: (options.groups || []).concat('component') }, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
    errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options);
    errors = await validateCrossDictionaryCollisions(expanded, 'services', 'tasks', errors); // makes sure services and tasks don't have any common keys
    if ((options.groups || []).includes('developer')) {
      errors = errors.concat(validateInterpolation(serialize(expanded), this.getContext(), ['architect.', 'dependencies.']));
    }
    return errors;
  }
}
