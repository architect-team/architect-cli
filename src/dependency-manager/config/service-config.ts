import { DeploySpec } from '../spec/service-spec';
import { Dictionary } from '../utils/dictionary';
import { LivenessProbeConfig, VolumeConfig } from './common-config';
import { ResourceConfig } from './resource-config';

// Custom ingress TLS
export interface IngressTlsConfig {
  crt: string;
  key: string;
  ca?: string;
}

export interface IngressConfig {
  enabled?: boolean;
  subdomain?: string;
  tls?: IngressTlsConfig;
  path?: string;
  ip_whitelist?: string[] | string;
  sticky?: boolean | string;
  private: boolean;

  // Context
  consumers?: string[];
  dns_zone?: string;
  host?: null | string;
  port?: number | string;
  protocol?: string;
  username?: null | string;
  password?: null | string;
  url?: string;
}

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
  path?: string;
  ingress?: IngressConfig;
}

export interface DatabaseConfig {
  type: string;
  connection_string?: string;
  url?: string;
}

export interface ServiceConfig extends ResourceConfig {
  enabled: boolean;
  debug?: ServiceConfig;
  interfaces: Dictionary<ServiceInterfaceConfig>;
  liveness_probe?: LivenessProbeConfig;
  volumes: Dictionary<VolumeConfig>;
  replicas: number | string; // TODO:290:number
  scaling?: ScalingConfig;
  deploy?: DeploySpec;
  termination_grace_period?: string;
}
