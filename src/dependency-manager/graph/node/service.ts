import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig, ServiceInterfaceConfig } from '../../config/service-config';

export interface ServiceNodeOptions {
  ref: string;
  component_ref: string;
  service_name: string;
  config: ServiceConfig;
  local_path?: string;
  artifact_image?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  config!: ServiceConfig;

  ref!: string;
  component_ref!: string;
  service_name!: string;
  local_path?: string;
  artifact_image?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.component_ref = options.component_ref;
      this.service_name = options.service_name;
      this.config = options.config;
      this.artifact_image = options.artifact_image;
      this.local_path = options.local_path;
    }
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
}
