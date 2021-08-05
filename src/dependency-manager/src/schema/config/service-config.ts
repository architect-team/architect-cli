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
  success_threshold?: number;
  failure_threshold?: number;
  timeout?: number;
  interval?: number;
  initial_delay?: number;
  path?: string;
  command?: string[];
  port: number;
}

export interface ServiceConfig extends ResourceConfig {
  debug?: ServiceConfig;
  interfaces?: Dictionary<InterfaceConfig>;
  liveness_probe?: LivenessProbeConfig;
  replicas: string;
  scaling?: ScalingConfig;
}
