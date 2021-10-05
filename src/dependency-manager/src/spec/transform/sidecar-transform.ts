import { ComponentInstanceMetadata } from '../../config/component-config';
import { SidecarConfig } from '../../config/sidecar-config';
import { SidecarSpec } from '../sidecar-spec';
import { transformLivenessProbeSpec } from './common-transform';
import { transformResourceSpec } from './resource-transform';
import { ComponentSlugUtils, ServiceSidecarVersionSlugUtils } from '../utils/slugs';

export const transformSidecarSpec = (key: string, spec: SidecarSpec, component_ref: string, tag: string, instance_metadata?: ComponentInstanceMetadata): SidecarConfig => {
  const resource_config = transformResourceSpec(key, spec, component_ref, tag, instance_metadata);
  const { component_account_name, component_name } = ComponentSlugUtils.parse(component_ref);

  return {
    ...resource_config,
    ref: ServiceSidecarVersionSlugUtils.build(component_account_name, component_name, resource_config.name, key, tag, instance_metadata?.instance_name),
    enabled: spec.enabled || SidecarSpec.default_enabled,
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe, resource_config.environment),
  };
};
