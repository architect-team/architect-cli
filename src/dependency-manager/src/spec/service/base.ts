import { Dictionary } from '../../utils/dictionary';
import { ResourceConfig } from '../resource/base';

export interface InterfaceSpec {
  description?: string;
  host?: string;
  port: string;
  url?: string;
  protocol?: string;
  domains?: string[];
}

export interface ServiceLivenessProbe {
  success_threshold?: string;
  failure_threshold?: string;
  timeout?: string;
  path?: string;
  interval?: string;
  command?: string[];
  port?: string;
  initial_delay?: string;
}

export interface ServiceConfig extends ResourceConfig {
  getInterfaces(): Dictionary<InterfaceSpec>;
  setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  setInterface(key: string, value: InterfaceSpec | string): void;

  getDebugOptions(): ServiceConfig | undefined;
  setDebugOptions(value: ServiceConfig): void;

  getReplicas(): string;
  getLivenessProbe(): ServiceLivenessProbe | undefined;
}
