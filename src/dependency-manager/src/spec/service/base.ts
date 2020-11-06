import { Dictionary } from '../../utils/dictionary';
import { InterfaceSpec } from '../common/interface-spec';
import { ServiceLivenessProbe } from '../common/liveness-probe-spec';
import { ResourceConfig } from '../resource/base';

export interface ServiceConfig extends ResourceConfig {
  getInterfaces(): Dictionary<InterfaceSpec>;
  setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  setInterface(key: string, value: InterfaceSpec | string): void;

  getDebugOptions(): ServiceConfig | undefined;
  setDebugOptions(value: ServiceConfig): void;

  getReplicas(): string;
  getLivenessProbe(): ServiceLivenessProbe | undefined;
}
