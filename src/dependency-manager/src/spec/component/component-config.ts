import { Dictionary } from '../../utils/dictionary';
import { ComponentSlug, ComponentTag, ComponentVersionSlug, ComponentVersionSlugUtils, InterfaceSlugUtils, ResourceVersionSlug, ResourceVersionSlugUtils } from '../../utils/slugs';
import { BaseConfig } from '../base-spec';
import { InterfaceSpec } from '../common/interface-spec';
import { ParameterDefinitionSpec, ParameterValueSpec } from '../common/parameter-spec';
import { ServiceConfig } from '../service/service-config';
import { TaskConfig } from '../task/task-config';

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

  abstract setArtifactImage(image: string): void;
  abstract getArtifactImage(): string | undefined;

  abstract getContext(): any;

  getInterfacesRef() {
    return `${this.getRef()}${InterfaceSlugUtils.Suffix}`;
  }

  getComponentVersion(): ComponentTag {
    return ComponentVersionSlugUtils.parse(this.getRef()).tag;
  }

  getServiceRef(service_name: string): ResourceVersionSlug {
    const parsed = ComponentVersionSlugUtils.parse(this.getRef());
    return ResourceVersionSlugUtils.build({ ...parsed, resource_name: service_name });
  }

  getServiceByRef(service_ref: string): ServiceConfig | undefined {
    console.log('#getServiceByRef() service_ref: ');
    console.log(service_ref);
    if (service_ref.startsWith(this.getName())) {
      const [service_name, component_tag] = service_ref.substr(this.getName().length + 1).split(':');
      if (component_tag === this.getComponentVersion()) {
        return this.getServices()[service_name];
      }
    }
  }

  getTaskRef(task_name: string): ResourceVersionSlug {
    const parsed = ComponentVersionSlugUtils.parse(this.getRef());
    return ResourceVersionSlugUtils.build({ ...parsed, resource_name: task_name });
  }

  getTaskByRef(task_ref: string): TaskConfig | undefined {
    console.log('#getTaskByRef() task_ref: ');
    console.log(task_ref);
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
