
export interface LivenessProbeConfig {
  success_threshold: number | string; // TODO:290:number
  failure_threshold: number | string; // TODO:290:number
  timeout: string;
  interval: string;
  initial_delay: string;
  path?: string;
  command?: string[];
  port?: number | string; // TODO:290:number
}
