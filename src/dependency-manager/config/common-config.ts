
export interface LivenessProbeConfig {
  success_threshold: number | string; // TODO:290:number
  failure_threshold: number | string; // TODO:290:number
  timeout: string;
  interval: string;
  initial_delay: string;
  path?: string; // deprecated
  command?: string[];
  port?: number | string;  // deprecated
}

// Though VolumeConfig is only used in the ServiceConfig, it's expected that this
// config object can and will be used in other resources in the future.
export interface VolumeConfig {
  mount_path?: string;
  host_path?: string;
  key?: string;
  description?: string;
  readonly?: boolean | string;
}
