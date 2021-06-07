
export interface LivenessProbeSpec {
  success_threshold: string;
  failure_threshold: string;
  timeout: string;
  path?: string;
  interval: string;
  command?: string[];
  port?: string;
  initial_delay: string;
}
