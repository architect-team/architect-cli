import { Dictionary } from '../../utils/dictionary';
import { ResourceConfig } from './resource-config';

export interface ScalingMetricsConfig {
  cpu?: number | string;
  memory?: string;
}

export interface ScalingConfig {
  min_replicas: number | string;
  max_replicas: number | string;
  metrics: ScalingMetricsConfig;
}

export interface ServiceInterfaceConfig {
  description?: string;
  host?: null | string;
  port?: number | string; // // TODO:290: expect number post-interpolation
  protocol?: string;
  username?: null | string;
  password?: null | string;
  url?: string;
  sticky?: boolean | string;
}

export interface LivenessProbeConfig {
  success_threshold: number | string;
  failure_threshold: number | string;
  timeout: string;
  interval: string;
  initial_delay: string;
  path?: string;
  command?: string[];
  port: number | string;
}

export interface ServiceConfig extends ResourceConfig {
  debug?: ServiceConfig;
  interfaces: Dictionary<ServiceInterfaceConfig>;
  liveness_probe?: LivenessProbeConfig;
  replicas: number | string;
  scaling?: ScalingConfig;
}
