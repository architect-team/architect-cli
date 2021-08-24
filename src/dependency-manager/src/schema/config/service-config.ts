import { Dictionary } from '../../utils/dictionary';
import { ResourceConfig } from './resource-config';

export interface ScalingMetricsConfig {
  cpu?: number | string; // TODO:290:number
  memory?: string;
}

export interface ScalingConfig {
  min_replicas: number | string; // TODO:290:number
  max_replicas: number | string; // TODO:290:number
  metrics: ScalingMetricsConfig;
}

export interface ServiceInterfaceConfig {
  description?: string;
  host?: null | string; // TODO:290:string
  port?: number | string; // TODO:290:number
  protocol?: string;
  username?: null | string; // TODO:290:string
  password?: null | string; // TODO:290:string
  url?: string;
  sticky?: boolean | string;
}

export interface LivenessProbeConfig {
  success_threshold: number | string; // TODO:290:number
  failure_threshold: number | string; // TODO:290:number
  timeout: string;
  interval: string;
  initial_delay: string;
  path?: string;
  command?: string[];
  port: number | string; // TODO:290:number
}

export interface ServiceConfig extends ResourceConfig {
  debug?: ServiceConfig;
  interfaces: Dictionary<ServiceInterfaceConfig>;
  liveness_probe?: LivenessProbeConfig;
  replicas: number | string; // TODO:290:number
  scaling?: ScalingConfig;
}
