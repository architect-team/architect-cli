import { ComponentVersionSlug } from '../utils/slugs';

export interface ComponentConfig {
  __version?: string;

  name: string;
  interfaces: { [key: string]: InterfaceConfig };
  ref: ComponentVersionSlug;
  instance_id: string;
  instance_name: string;
  instance_date: Date;

  // services: ...
  // tasks: ...
}

export interface InterfaceConfig {
  description?: string;
  host?: string;
  port: number;
  protocol?: string;
  username?: string;
  password?: string;
  url?: string;
  sticky?: string;
}
