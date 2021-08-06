import { Dictionary } from '../../utils/dictionary';
import { ResourceConfig } from './resource-config';

export interface ScalingMetricsConfig {
  cpu?: string;
  memory?: string;
}

export interface ScalingConfig {
  min_replicas: string;
  max_replicas: string;
  metrics: ScalingMetricsConfig;
}

export interface InterfaceConfig {
  description?: string;
  host?: string;
  port: string;
  protocol?: string;
  username?: string;
  password?: string;
  url?: string;
  sticky?: boolean | string;
}

export interface LivenessProbeConfig {
  success_threshold?: string;
  failure_threshold?: string;
  timeout?: string;
  interval?: string;
  initial_delay?: string;
  path?: string;
  command?: string[];
  port: number | string;
}

export interface ServiceConfig extends ResourceConfig {
  debug?: ServiceConfig;
  interfaces?: Dictionary<InterfaceConfig>;
  liveness_probe?: LivenessProbeConfig;
  replicas: string;
  scaling?: ScalingConfig;
}
