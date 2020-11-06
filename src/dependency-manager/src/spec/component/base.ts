import { Dictionary } from '../../utils/dictionary';
import { ComponentSlug, ComponentTag, ComponentVersionSlug, ComponentVersionSlugUtils, InterfaceSlugUtils, ServiceVersionSlug, ServiceVersionSlugUtils } from '../../utils/slugs';
import { BaseConfig } from '../base-spec';
import { InterfaceSpec } from '../common/interface-spec';
import { ParameterDefinitionSpec, ParameterValueSpec } from '../common/parameter-spec';
import { ServiceConfig } from '../service/base';
import { TaskConfig } from '../task/base';

export abstract class ComponentConfig extends BaseConfig {
  abstract __version?: string;

  abstract getName(): ComponentSlug;
  abstract getRef(): ComponentVersionSlug;
  abstract getExtends(): string | undefined;
  abstract setExtends(ext: string): void;
  abstract getLocalPath(): string | undefined;
  abstract getDescription(): string;
  abstract getKeywords(): string[];
  abstract getAuthor(): string;

  abstract getParameters(): Dictionary<ParameterDefinitionSpec>;
  abstract setParameters(value: Dictionary<ParameterValueSpec>): void;
  abstract setParameter(key: string, value: ParameterValueSpec): void;

  abstract getServices(): Dictionary<ServiceConfig>;
  abstract setServices(value: Dictionary<ServiceConfig>): void;
  abstract setService(key: string, value: ServiceConfig): void;

  abstract getTasks(): Dictionary<TaskConfig>;
  abstract setTasks(value: Dictionary<TaskConfig>): void;
  abstract setTask(key: string, value: TaskConfig): void;

  abstract getDependencies(): Dictionary<string>;

  abstract getInterfaces(): Dictionary<InterfaceSpec>;
  abstract setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  abstract setInterface(key: string, value: InterfaceSpec | string): void;

  abstract getContext(): any;

  getInterfacesRef() {
    return `${this.getRef()}${InterfaceSlugUtils.Suffix}`;
  }

  getComponentVersion(): ComponentTag {
    return ComponentVersionSlugUtils.parse(this.getRef()).tag;
  }

  getServiceRef(service_name: string): ServiceVersionSlug {
    const parsed = ComponentVersionSlugUtils.parse(this.getRef());
    return ServiceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, service_name, parsed.tag);
  }

  getServiceByRef(service_ref: string): ServiceConfig | undefined {
    if (service_ref.startsWith(this.getName())) {
      const [service_name, component_tag] = service_ref.substr(this.getName().length + 1).split(':');
      if (component_tag === this.getComponentVersion()) {
        return this.getServices()[service_name];
      }
    }
  }

  getTaskRef(task_name: string): ServiceVersionSlug {
    const parsed = ComponentVersionSlugUtils.parse(this.getRef());
    return ServiceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, task_name, parsed.tag);
  }

  getTaskByRef(task_ref: string): TaskConfig | undefined {
    if (task_ref.startsWith(this.getName())) {
      const [task_name, component_tag] = task_ref.substr(this.getName().length + 1).split(':');
      if (component_tag === this.getComponentVersion()) {
        return this.getTasks()[task_name];
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
    for (const [key, value] of Object.entries(this.getTasks())) {
      config.setTask(key, value.expand());
    }
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }

    return config;
  }
}
