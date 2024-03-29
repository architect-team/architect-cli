import { ServiceConfig, ServiceInterfaceConfig } from '../../config/service-config';
import { transformDictionary } from '../../utils/dictionary';
import { ComponentInstanceMetadata } from '../component-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../service-spec';
import { transformLivenessProbeSpec, transformVolumeSpec } from './common-transform';
import { transformResourceSpec } from './resource-transform';

export const transformInterfaceSpec = function (key: string, interface_spec: ServiceInterfaceSpec | string | number): ServiceInterfaceConfig {
  if (interface_spec instanceof Object) {
    const interface_config: ServiceInterfaceConfig = interface_spec as Omit<ServiceInterfaceSpec, 'ingress'>;

    if (interface_spec.ingress) {
      interface_config.ingress = {
        ...interface_spec.ingress,
        private: Boolean(interface_spec.ingress.private) || false,
      };
    }

    return interface_config;
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
    termination_grace_period: spec.termination_grace_period || '30s',
  };
};
