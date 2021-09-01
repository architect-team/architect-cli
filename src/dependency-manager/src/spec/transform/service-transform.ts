import { parse as shell_parse } from 'shell-quote';
import { ComponentInstanceMetadata } from '../../config/component-config';
import { LivenessProbeConfig, ServiceConfig, ServiceInterfaceConfig } from '../../config/service-config';
import { Dictionary, transformDictionary } from '../../utils/dictionary';
import { LivenessProbeSpec, ServiceInterfaceSpec, ServiceSpec } from '../service-spec';
import { transformResourceSpec } from './resource-transform';

export const transformInterfaceSpec = function (key: string, interface_spec: ServiceInterfaceSpec | string | number): ServiceInterfaceConfig {
  if (interface_spec instanceof Object) {
    return interface_spec;
  } else {
    return { port: interface_spec };
  }
};

export const transformLivenessProbeSpecCommand = function (command: string[] | string | undefined): string[] | undefined {
  if (!command) {
    return undefined;
  }
  if (typeof command === 'string') {
    return shell_parse(command.replace(/\$/g, '__arc__')).map(e => `${e}`.replace(/__arc__/g, '$'));
  } else {
    return command;
  }
};

export const transformLivenessProbeSpec = function (liveness_probe: LivenessProbeSpec | undefined, environment: Dictionary<string | null>): LivenessProbeConfig | undefined {
  if (!liveness_probe || !Object.keys(liveness_probe).length) { return undefined; }

  return {
    success_threshold: liveness_probe.success_threshold || LivenessProbeSpec.default_success_threshold,
    failure_threshold: liveness_probe.failure_threshold || LivenessProbeSpec.default_failure_threshold,
    timeout: liveness_probe.timeout || LivenessProbeSpec.default_timeout,
    interval: liveness_probe.interval || LivenessProbeSpec.default_interval,
    initial_delay: liveness_probe.initial_delay || LivenessProbeSpec.default_initial_delay,
    path: liveness_probe.path,
    command: transformLivenessProbeSpecCommand(liveness_probe.command),
    port: liveness_probe.port,
  };
};

export const transformServiceSpec = (key: string, spec: ServiceSpec, component_ref: string, tag: string, instance_metadata?: ComponentInstanceMetadata): ServiceConfig => {
  const resource_config = transformResourceSpec(key, spec, component_ref, tag, instance_metadata);

  return {
    ...resource_config,
    debug: spec.debug ? transformServiceSpec(key, spec.debug, component_ref, tag, instance_metadata) : undefined,
    interfaces: transformDictionary(transformInterfaceSpec, spec.interfaces),
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe, resource_config.environment),
    replicas: spec.replicas || 1,
    scaling: spec.scaling,
  };
};


