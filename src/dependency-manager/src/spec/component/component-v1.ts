import { plainToClass, serialize, Transform } from 'class-transformer';
import { Allow, IsObject, IsOptional, IsString, IsUrl, Matches, ValidatorOptions } from 'class-validator';
import { Dictionary } from '../../utils/dictionary';
import { ComponentSlug, ComponentSlugUtils, ComponentVersionSlug, ComponentVersionSlugUtils, Slugs } from '../../utils/slugs';
import { validateCrossDictionaryCollisions, validateDependsOn, validateDictionary, validateInterpolation } from '../../utils/validation';
import { DictionaryType } from '../../utils/validators/dictionary_type';
import { InterfaceSpec } from '../common/interface-spec';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { ParameterValue } from '../common/parameter-spec';
import { transformParameters } from '../common/parameter-transformer';
import { ParameterValueSpecV1 } from '../common/parameter-v1';
import { ServiceConfig } from '../service/service-config';
import { transformServices } from '../service/service-transformer';
import { TaskConfig } from '../task/task-config';
import { transformTasks } from '../task/task-transformer';
import { ComponentConfig } from './component-config';

export const transformComponentInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  // TODO: Be more flexible than just url ref
  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Object && 'host' in value && 'port' in value) {
      output[key] = plainToClass(InterfaceSpecV1, value);
    } else {
      let host, port, protocol, username, password;
      let url = value instanceof Object ? value.url : value;

      const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
      const matches = url_regex.exec(url);
      if (matches) {
        host = `\${{ ${matches[1]}.host }}`;
        port = `\${{ ${matches[1]}.port }}`;
        protocol = `\${{ ${matches[1]}.protocol }}`;
        username = `\${{ ${matches[1]}.username }}`;
        password = `\${{ ${matches[1]}.password }}`;
        url = `\${{ ${matches[1]}.url }}`;

        output[key] = plainToClass(InterfaceSpecV1, {
          host,
          port,
          username,
          password,
          protocol,
          url,
        });
      } else {
        throw new Error(`Invalid interface regex: ${url}`);
      }
    }
  }

  return output;
};

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
  ingresses: Dictionary<InterfaceSpec>;
  interfaces: Dictionary<InterfaceSpec>;
  services: Dictionary<ServiceContextV1>;
  tasks: Dictionary<TaskContextV1>;
}

export class ComponentConfigV1 extends ComponentConfig {
  @Allow({ always: true })
  __version?: string;

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
  instance_id!: string;

  @IsOptional({ always: true })
  instance_name!: string;

  @IsOptional({ always: true })
  instance_date!: Date;

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
  @IsUrl({}, { always: true })
  homepage?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  parameters?: Dictionary<ParameterValueSpecV1>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform((params) => !params?.value ? {} : params.value)
  services?: Dictionary<ServiceConfig>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform((params) => !params?.value ? {} : params.value)
  tasks?: Dictionary<TaskConfig>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @DictionaryType('string', { always: true, message: 'dependency versions must be strings' })
  dependencies?: Dictionary<string>;

  @IsOptional({ always: true })
  @IsObject({ groups: ['developer'] })
  @Transform((params) => !params?.value ? {} : params.value)
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  @IsOptional({ always: true })
  @IsString({ always: true })
  artifact_image?: string;

  getName(): ComponentSlug {
    const split = ComponentVersionSlugUtils.parse(this.name);
    return ComponentSlugUtils.build(split.component_account_name, split.component_name);
  }

  setName(name: string): void {
    this.name = name;
  }

  getTag(): ComponentSlug {
    const split = ComponentVersionSlugUtils.parse(this.name);
    return split.tag;
  }

  getRef(): ComponentVersionSlug {
    const split = ComponentVersionSlugUtils.parse(this.name);
    return ComponentVersionSlugUtils.build(split.component_account_name, split.component_name, split.tag, this.getInstanceName());
  }

  getInstanceId() {
    return this.instance_id || '';
  }

  setInstanceId(instance_id: string) {
    this.instance_id = instance_id;
  }

  getInstanceName() {
    return this.instance_name || '';
  }

  setInstanceName(instance_name: string) {
    this.instance_name = instance_name;
  }

  getInstanceDate() {
    return this.instance_date || new Date();
  }

  setInstanceDate(instance_date: Date) {
    this.instance_date = instance_date;
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

  getHomepage() {
    return this.homepage || '';
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
    return transformServices(this.services || {}, this.getRef()) || {};
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
    return transformTasks(this.tasks || {}, this.getRef()) || {};
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
      username: '',
      password: '',
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

    const ingresses: Dictionary<InterfaceSpec> = {};
    for (const [ik, iv] of Object.entries(this.getInterfaces())) {
      ingresses[ik] = {
        ...interface_filler,
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
      ingresses,
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
    errors = await validateDependsOn(expanded, errors); // makes sure service depends_on refers to valid other services
    if ((options.groups || []).includes('developer')) {
      errors = errors.concat(validateInterpolation(serialize(expanded), this.getContext(), ['architect.', 'dependencies.', 'environment.']));
    }
    return errors;
  }
}
