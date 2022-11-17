import { DependencyNode, DependencyNodeOptions } from '.';
import { ResourceSlugUtils } from '../../..';
import { ServiceConfig, ServiceInterfaceConfig } from '../../config/service-config';

export interface ServiceNodeOptions {
  ref: string;
  component_ref: string;
  config: ServiceConfig;
  local_path?: string;
  artifact_image?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  config!: ServiceConfig;

  ref!: string;
  component_ref!: string;
  local_path!: string;
  artifact_image?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.component_ref = options.component_ref;
      this.config = options.config;
      this.local_path = options.local_path || '';
      this.artifact_image = options.artifact_image;
    }
  }

  get service_name(): string {
    const { resource_name } = ResourceSlugUtils.parse(this.config.metadata.ref);
    return resource_name;
  }

  get interfaces(): { [key: string]: ServiceInterfaceConfig } {
    return this.config.interfaces;
  }

  get ports(): string[] {
    const ports = Object.values(this.interfaces).map((i) => i.port) as string[];
    return [...new Set(ports)];
  }

  get is_external(): boolean {
    return Object.keys(this.interfaces).length > 0 && Object.values(this.interfaces).every((i) => i.host);
  }

  get is_local(): boolean {
    return this.local_path !== '';
  }
}
