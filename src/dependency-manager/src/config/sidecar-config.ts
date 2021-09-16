import { LivenessProbeConfig } from './common-config';
import { ResourceConfig } from './resource-config';

export interface SidecarConfig extends ResourceConfig {
  enabled: boolean;
  liveness_probe?: LivenessProbeConfig;
  debug?: ResourceConfig;
}
