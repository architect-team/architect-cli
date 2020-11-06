import { Transform, Type } from 'class-transformer/decorators';
import { IsEmpty, IsInstance, IsObject, IsOptional, ValidatorOptions } from 'class-validator';
import { parse as shell_parse } from 'shell-quote';
import { Dictionary } from '../../utils/dictionary';
import { validateDictionary, validateNested } from '../../utils/validation';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { ServiceLivenessProbe } from '../common/liveness-probe-spec';
import { LivenessProbeV1 } from '../common/liveness-probe-v1';
import { ResourceConfigV1 } from '../resource/v1';
import { ServiceConfig } from './base';
import { transformServiceInterfaces } from './transformer';

export class ServiceConfigV1 extends ResourceConfigV1 implements ServiceConfig {
  @Type(() => ServiceConfigV1)
  @IsOptional({ always: true })
  @IsInstance(ServiceConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: ServiceConfigV1;

  @IsOptional({ groups: ['operator', 'debug'] })
  @IsObject({ groups: ['developer'], message: 'interfaces must be defined even if it is empty since the majority of services need to expose ports' })
  @Transform((value) => !value ? {} : value)
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  @Type(() => LivenessProbeV1)
  @IsOptional({ always: true })
  @IsInstance(LivenessProbeV1, { always: true })
  liveness_probe?: LivenessProbeV1;

  @IsOptional({ always: true })
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a replica count when registering services',
  })
  @Type(() => String)
  replicas?: string;

  async validate(options?: ValidatorOptions) {
    if (!options) { options = {}; }
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateNested(expanded, 'liveness_probe', errors, options);
    errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options);
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

  getLivenessProbe(): ServiceLivenessProbe | undefined {
    if (!this.liveness_probe || !Object.keys(this.liveness_probe).length) { return undefined; }

    const liveness_probe = {
      success_threshold: '1',
      failure_threshold: '1',
      timeout: '5s',
      interval: '30s',
      initial_delay: '0s',
      ...this.liveness_probe,
    };

    if (this.liveness_probe.command && typeof this.liveness_probe.command === 'string') {
      liveness_probe.command = shell_parse(this.liveness_probe.command).map(e => `${e}`);
    }

    return liveness_probe as ServiceLivenessProbe;
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

  /** @return New expanded copy of the current config */
  expand() {
    const config = super.expand();
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }
    return config;
  }
}
