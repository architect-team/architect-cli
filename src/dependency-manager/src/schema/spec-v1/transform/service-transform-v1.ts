import { parse as shell_parse } from 'shell-quote';
import { Dictionary, transformDictionary } from '../../../utils/dictionary';
import { InterfaceConfig, LivenessProbeConfig, ServiceConfig } from '../../config/service-config';
import { InterfaceSpecV1, LivenessProbeSpecV1, ServiceSpecV1 } from '../service-spec-v1';
import { transformResourceSpecV1 } from './resource-transform-v1';

export const transformInterfaceSpecV1 = function (key: string, interface_spec: InterfaceSpecV1 | string): InterfaceConfig {
  if (interface_spec instanceof Object) {
    return interface_spec;
  } else {
    return { port: interface_spec };
  }
};

export const transformLivenessProbeSpecV1Command = function (command: string[] | string | undefined, environment: Dictionary<string>): string[] | undefined {
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

export const transformLivenessProbeSpecV1 = function (liveness_probe: LivenessProbeSpecV1 | undefined, environment: Dictionary<string>): LivenessProbeConfig | undefined {
  if (!liveness_probe || !Object.keys(liveness_probe).length) { return undefined; }

  return {
    success_threshold: liveness_probe.success_threshold || '1',
    failure_threshold: liveness_probe.failure_threshold || '3',
    timeout: liveness_probe.timeout || '5s',
    interval: liveness_probe.interval || '30s',
    initial_delay: liveness_probe.initial_delay || '0s',
    path: liveness_probe.path,
    command: transformLivenessProbeSpecV1Command(liveness_probe.command, environment),
    port: liveness_probe.port,
  };
};

export const transformServiceSpecV1 = (key: string, spec: ServiceSpecV1): ServiceConfig => {
  const resource_config = transformResourceSpecV1(key, spec);

  return {
    ...resource_config,
    debug: spec.debug ? transformServiceSpecV1(key, spec.debug) : undefined,
    interfaces: transformDictionary(transformInterfaceSpecV1, spec.interfaces),
    liveness_probe: transformLivenessProbeSpecV1(spec.liveness_probe, resource_config.environment),
    replicas: spec.replicas || '1',
    scaling: spec.scaling,
  };
};

// TODO:269:expand
  // /** @return New expanded copy of the current config */
  // expand() {
  //   const config = super.expand();
  //   for (const [key, value] of Object.entries(this.getInterfaces())) {
  //     config.setInterface(key, value);
  //   }
  //   return config;
  // }

