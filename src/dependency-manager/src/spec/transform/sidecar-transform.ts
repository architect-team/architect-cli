import { ComponentInstanceMetadata } from '../../config/component-config';
import { SidecarConfig } from '../../config/sidecar-config';
import { SidecarSpec } from '../sidecar-spec';
import { transformLivenessProbeSpec } from './common-transform';
import { transformResourceSpec } from './resource-transform';

export const transformSidecarSpec = (key: string, spec: SidecarSpec, component_ref: string, tag: string, instance_metadata?: ComponentInstanceMetadata): SidecarConfig => {
  const resource_config = transformResourceSpec(key, spec, component_ref, tag, instance_metadata);

  return {
    ...resource_config,
    enabled: spec.enabled || SidecarSpec.default_enabled,
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe, resource_config.environment),
    debug: spec.debug ? transformSidecarSpec(key, spec.debug, component_ref, tag, instance_metadata) : undefined,
  };
};
