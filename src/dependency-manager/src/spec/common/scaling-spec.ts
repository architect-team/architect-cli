export interface ScalingMetricsSpec {
  cpu?: string;
  memory?: string;
}

export interface ScalingSpec {
  min_replicas?: string;
  max_replicas?: string;
  metrics?: ScalingMetricsSpec;
}
