import { ClassConstructor, plainToInstance, TransformFnParams } from 'class-transformer';
import stringArgv from 'string-argv';
import { LivenessProbeConfig, VolumeConfig } from '../../config/common-config';
import { LivenessProbeSpec, VolumeSpec } from '../common-spec';

export const transformLivenessProbeSpecCommand = function (command: string[] | string | undefined): string[] | undefined {
  if (!command) {
    return undefined;
  }
  if (typeof command === 'string') {
    return stringArgv(command);
  } else {
    return command;
  }
};

export const transformLivenessProbeSpec = function (liveness_probe: LivenessProbeSpec | undefined): LivenessProbeConfig | undefined {
  if (!liveness_probe || Object.keys(liveness_probe).length === 0) {
    return undefined;
  }

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

export const transformVolumeSpec = (key: string, volume: VolumeSpec | string): VolumeConfig => {
  if (volume instanceof Object) {
    return {
      mount_path: volume.mount_path,
      host_path: volume.host_path,
      key: volume.key,
      description: volume.description,
      readonly: volume.readonly,
    };
  } else {
    return {
      mount_path: volume,
    };
  }
};

export const transformObject = (cls: ClassConstructor<any>): (params: TransformFnParams) => any => {
  return ({ value }) => {
    for (const [k, v] of Object.entries(value)) {
      value[k] = v instanceof Object ? plainToInstance(cls, v) : v;
    }
    return value;
  };
};
