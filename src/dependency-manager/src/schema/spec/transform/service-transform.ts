import { parse as shell_parse } from 'shell-quote';
import { Dictionary, transformDictionary } from '../../../utils/dictionary';
import { InterfaceConfig, LivenessProbeConfig, ServiceConfig } from '../../config/service-config';
import { InterfaceSpec, LivenessProbeSpec, ServiceSpec } from '../service-spec';
import { transformResourceSpec } from './resource-transform';

export const transformInterfaceSpec = function (key: string, interface_spec: InterfaceSpec | string): InterfaceConfig {
  if (interface_spec instanceof Object) {
    return interface_spec;
  } else {
    return { port: interface_spec };
  }
};

export const transformLivenessProbeSpecCommand = function (command: string[] | string | undefined, environment: Dictionary<string>): string[] | undefined {
  if (!command) {
    return undefined;
  }
  if (typeof command === 'string') {
    const env: Dictionary<string> = {};
    for (const key of Object.keys(environment)) {
      env[key] = `$${key}`;
    }
    return shell_parse(command, env).map(e => `${e}`);
  } else {
    return command;
  }
};

export const transformLivenessProbeSpec = function (liveness_probe: LivenessProbeSpec | undefined, environment: Dictionary<string>): LivenessProbeConfig | undefined {
  if (!liveness_probe || !Object.keys(liveness_probe).length) { return undefined; }

  return {
    success_threshold: liveness_probe.success_threshold || '1',
    failure_threshold: liveness_probe.failure_threshold || '3',
    timeout: liveness_probe.timeout || '5s',
    interval: liveness_probe.interval || '30s',
    initial_delay: liveness_probe.initial_delay || '0s',
    path: liveness_probe.path,
    command: transformLivenessProbeSpecCommand(liveness_probe.command, environment),
    port: liveness_probe.port,
  };
};

export const transformServiceSpec = (key: string, spec: ServiceSpec): ServiceConfig => {
  const resource_config = transformResourceSpec(key, spec);

  return {
    ...resource_config,
    debug: spec.debug ? transformServiceSpec(key, spec.debug) : undefined,
    interfaces: transformDictionary(transformInterfaceSpec, spec.interfaces),
    liveness_probe: transformLivenessProbeSpec(spec.liveness_probe, resource_config.environment),
    replicas: spec.replicas || '1',
    scaling: spec.scaling,
  };
};


