import { LivenessProbeConfig } from './common-config';
import { ResourceConfig } from './resource-config';

export interface SidecarConfig extends Omit<ResourceConfig, 'build'> {
  enabled: boolean;
  liveness_probe?: LivenessProbeConfig;
}
