import { ComponentInstanceMetadata } from '../../config/component-config';
import { ServiceConfig, ServiceInterfaceConfig } from '../../config/service-config';
import { transformDictionary } from '../../utils/dictionary';
import { ServiceSpec, ServiceInterfaceSpec } from '../service-spec';
import { transformLivenessProbeSpec } from './common-transform';
import { transformResourceSpec } from './resource-transform';
import { transformSidecarSpec } from './sidecar-transform';

export const transformInterfaceSpec = function (key: string, interface_spec: ServiceInterfaceSpec | string | number): ServiceInterfaceConfig {
  if (interface_spec instanceof Object) {
    return interface_spec;
  } else {
    return { port: interface_spec };
  }
};

export const transformServiceSpec = (key: string, spec: ServiceSpec, component_ref: string, tag: string, instance_metadata?: ComponentInstanceMetadata): ServiceConfig => {
  const resource_config = transformResourceSpec(key, spec, component_ref, tag, instance_metadata);

  return {
    ...resource_config,
    debug: spec.debug ? transformServiceSpec(key, spec.debug, component_ref, tag, instance_metadata) : undefined,
    interfaces: transformDictionary(transformInterfaceSpec, spec.interfaces),
    sidecars: transformDictionary(transformSidecarSpec, spec.sidecars, component_ref, tag, instance_metadata),
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe, resource_config.environment),
    replicas: spec.replicas || 1,
    scaling: spec.scaling,
  };
};


