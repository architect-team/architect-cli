import { DeploySpec } from '../spec/service-spec';
import { Dictionary } from '../utils/dictionary';
import { LivenessProbeConfig, VolumeConfig } from './common-config';
import { IngressConfig } from './component-config';
import { ResourceConfig } from './resource-config';

export interface ScalingMetricsConfig {
  cpu?: number | string; // TODO:290:number
  memory?: number | string;
}

export interface ScalingConfig {
  min_replicas: number | string; // TODO:290:number
  max_replicas: number | string; // TODO:290:number
  metrics: ScalingMetricsConfig;
}

export interface ServiceInterfaceConfig {
  description?: string;
  host?: null | string; // TODO:290:string
  port: number | string; // TODO:290:number
  protocol?: string;
  username?: null | string; // TODO:290:string
  password?: null | string; // TODO:290:string
  url?: string;
  sticky?: boolean | string;

  ingress?: IngressConfig;
  deprecated_interface_name?: string;
}

export interface ServiceConfig extends ResourceConfig {
  debug?: ServiceConfig;
  interfaces: Dictionary<ServiceInterfaceConfig>;
  liveness_probe?: LivenessProbeConfig;
  volumes: Dictionary<VolumeConfig>;
  replicas: number | string; // TODO:290:number
  scaling?: ScalingConfig;
  deploy?: DeploySpec;
}
