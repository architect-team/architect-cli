import { SidecarConfig } from '../../config/sidecar-config';
import { ComponentInstanceMetadata } from '../component-spec';
import { SidecarSpec } from '../sidecar-spec';
import { transformLivenessProbeSpec } from './common-transform';
import { transformResourceSpec } from './resource-transform';

export const transformSidecarSpec = (key: string, spec: SidecarSpec, metadata: ComponentInstanceMetadata): SidecarConfig => {
  const resource_config = transformResourceSpec('services', key, spec, metadata);
  return {
    ...resource_config,
    enabled: spec.enabled || SidecarSpec.default_enabled,
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe, resource_config.environment),
  };
};
