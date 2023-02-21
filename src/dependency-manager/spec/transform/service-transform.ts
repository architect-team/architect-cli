import { ServiceConfig, ServiceInterfaceConfig } from '../../config/service-config';
import { transformDictionary } from '../../utils/dictionary';
import { ComponentInstanceMetadata } from '../component-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../service-spec';
import { transformLivenessProbeSpec, transformVolumeSpec } from './common-transform';
import { transformResourceSpec } from './resource-transform';

export const transformInterfaceSpec = function (key: string, interface_spec: ServiceInterfaceSpec | string | number): ServiceInterfaceConfig {
  if (interface_spec instanceof Object) {
    return interface_spec;
  } else {
    return { port: interface_spec };
  }
};

export const transformServiceSpec = (key: string, spec: ServiceSpec, metadata: ComponentInstanceMetadata): ServiceConfig => {
  const resource_config = transformResourceSpec('services', key, spec, metadata);

  return {
    ...resource_config,
    enabled: spec.enabled || true,
    debug: spec.debug ? transformServiceSpec(key, spec.debug, metadata) : undefined,
    interfaces: transformDictionary(transformInterfaceSpec, spec.interfaces),
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe),
    volumes: transformDictionary(transformVolumeSpec, spec.volumes),
    replicas: spec.replicas || 1,
    scaling: spec.scaling,
    deploy: spec.deploy,
  };
};
