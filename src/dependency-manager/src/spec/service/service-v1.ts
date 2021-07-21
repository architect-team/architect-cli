import { plainToClass, Transform, Type } from 'class-transformer';
import { IsEmpty, IsInstance, IsObject, IsOptional, ValidatorOptions } from 'class-validator';
import { parse as shell_parse } from 'shell-quote';
import { Dictionary } from '../../utils/dictionary';
import { validateNested } from '../../utils/validation';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { LivenessProbeSpec } from '../common/liveness-probe-spec';
import { LivenessProbeSpecV1 } from '../common/liveness-probe-v1';
import { ScalingSpecV1 } from '../common/scaling-v1';
import { ResourceConfigV1 } from '../resource/resource-v1';
import { ServiceConfig } from './service-config';

export const transformServiceInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object
      ? plainToClass(InterfaceSpecV1, value)
      : plainToClass(InterfaceSpecV1, { port: value });
  }
  return output;
};

export class ServiceConfigV1 extends ResourceConfigV1 implements ServiceConfig {
  @Type(() => ServiceConfigV1)
  @IsOptional({ always: true })
  @IsInstance(ServiceConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: ServiceConfigV1;

  @IsOptional({ always: true })
  @IsObject({ groups: ['developer'] })
  @Transform((params) => !params?.value ? {} : params.value)
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  @Type(() => LivenessProbeSpecV1)
  @IsOptional({ always: true })
  @IsInstance(LivenessProbeSpecV1, { always: true })
  liveness_probe?: LivenessProbeSpecV1;

  @IsOptional({ always: true })
  @Type(() => String)
  replicas?: string;

  @Type(() => ScalingSpecV1)
  @IsOptional({ always: true })
  @IsInstance(ScalingSpecV1, { always: true })
  scaling?: ScalingSpecV1;

  async validate(options?: ValidatorOptions) {
    if (!options) { options = {}; }
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateNested(expanded, 'liveness_probe', errors, options);
    errors = await validateNested(expanded, 'scaling', errors, options);
    errors = await validateNested(expanded, 'build', errors, options);
    return errors;
  }

  getInterfaces() {
    return transformServiceInterfaces(this.interfaces) || {};
  }

  setInterfaces(value: Dictionary<InterfaceSpecV1 | string>) {
    this.interfaces = value;
  }

  setInterface(key: string, value: InterfaceSpecV1 | string) {
    if (!this.interfaces) {
      this.interfaces = {};
    }
    this.interfaces[key] = value;
  }

  getLivenessProbe(): LivenessProbeSpec | undefined {
    if (!this.liveness_probe || !Object.keys(this.liveness_probe).length) { return undefined; }

    const liveness_probe = {
      success_threshold: '1',
      failure_threshold: '3',
      timeout: '5s',
      interval: '30s',
      initial_delay: '0s',
      ...this.liveness_probe,
    };

    if (this.liveness_probe.command && typeof this.liveness_probe.command === 'string') {
      liveness_probe.command = shell_parse(this.liveness_probe.command).map(e => `${e}`);
    }

    return liveness_probe as LivenessProbeSpec;
  }

  getDebugOptions(): ServiceConfigV1 | undefined {
    return this.debug;
  }

  setDebugOptions(value: ServiceConfigV1) {
    this.debug = value;
  }

  getReplicas() {
    return this.replicas || '1';
  }

  getScaling() {
    return {
      min_replicas: '1',
      max_replicas: '1',
      ...this.scaling,
      metrics: {
        cpu: '95',
        memory: '95',
        ...(this.scaling?.metrics || {}),
      },
    };
  }

  /** @return New expanded copy of the current config */
  expand() {
    const config = super.expand();
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }
    return config;
  }
}
