import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig } from '../../spec/service/service-config';
import { ServiceConfigV1 } from '../../spec/service/service-v1';

export interface ServiceNodeOptions {
  ref: string;
  node_config: ServiceConfig;
  local_path?: string;
  artifact_image?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  @Type(() => ServiceConfigV1)
  node_config!: ServiceConfig;

  ref!: string;
  local_path!: string;
  artifact_image?: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.node_config = options.node_config;
      this.local_path = options.local_path || '';
      this.artifact_image = options.artifact_image;
    }
  }

  get interfaces(): { [key: string]: any } {
    return this.node_config.getInterfaces();
  }

  get ports(): string[] {
    const ports = Object.values(this.interfaces).map((i) => i.port) as string[];
    return [...new Set(ports)];
  }

  get is_external() {
    return Object.keys(this.interfaces).length > 0 && Object.values(this.interfaces).every((i) => i.host && !i.host.startsWith('${{')); // a node cannot be determined to actually be external until its value is either set directly or interpolated
  }

  get is_local() {
    return this.local_path !== '';
  }
}
