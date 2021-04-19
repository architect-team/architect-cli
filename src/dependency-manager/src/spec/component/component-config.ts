import { Dictionary } from '../../utils/dictionary';
import { Refs } from '../../utils/refs';
import { ComponentSlug, ComponentTag, ComponentVersionSlug, ComponentVersionSlugUtils, ServiceVersionSlugUtils, Slugs } from '../../utils/slugs';
import { BaseConfig } from '../base-spec';
import { InterfaceSpec } from '../common/interface-spec';
import { ParameterDefinitionSpec, ParameterValueSpec } from '../common/parameter-spec';
import { ServiceConfig } from '../service/service-config';
import { TaskConfig } from '../task/task-config';

export abstract class ComponentConfig extends BaseConfig {
  abstract __version?: string;

  abstract getName(): ComponentSlug;
  abstract setName(name: string): void;
  abstract getTag(): string;
  abstract getRef(): ComponentVersionSlug;
  abstract getInstanceId(): string;
  abstract setInstanceId(instance_id: string): void;
  abstract getInstanceName(): string;
  abstract setInstanceName(instance_name: string): void;
  abstract getInstanceDate(): Date;
  abstract setInstanceDate(instance_date: Date): void;
  abstract getExtends(): string | undefined;
  abstract setExtends(ext: string): void;
  abstract getLocalPath(): string | undefined;
  abstract getDescription(): string;
  abstract getKeywords(): string[];
  abstract getAuthor(): string;
  abstract getHomepage(): string;

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

  getComponentVersion(): ComponentTag {
    return ComponentVersionSlugUtils.parse(this.getRef()).tag;
  }

  getInterfacesRef(max_length: number = Refs.DEFAULT_MAX_LENGTH) {
    return ComponentConfig.getNodeRef(this.getRef(), this.getInstanceId(), max_length);
  }

  static getNodeRef(service_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH) {
    let parsed;
    try {
      parsed = ServiceVersionSlugUtils.parse(service_ref);
    } catch {
      parsed = ComponentVersionSlugUtils.parse(service_ref);
    }

    let friendly_name = `${parsed.component_name}`;
    if (parsed.service_name) {
      friendly_name += `-${parsed.service_name}`;
    }
    if (parsed.instance_name) {
      friendly_name += `-${parsed.instance_name}`;
    }

    if (instance_id) {
      service_ref = `${service_ref}${Slugs.INSTANCE_DELIMITER}${instance_id}`;
    }

    return Refs.safeRef(friendly_name, service_ref, max_length);
  }

  getNodeRef(service_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH) {
    const parsed = ComponentVersionSlugUtils.parse(this.getRef());
    const service_ref = ServiceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, service_name, parsed.tag, this.getInstanceName());
    return ComponentConfig.getNodeRef(service_ref, this.getInstanceId(), max_length);
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
    for (const [key, value] of Object.entries(this.getTasks())) {
      config.setTask(key, value.expand());
    }
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }

    return config;
  }
}
