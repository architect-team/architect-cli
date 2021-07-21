import { Dictionary } from '../../utils/dictionary';
import { InterfaceSpec } from '../common/interface-spec';
import { LivenessProbeSpec } from '../common/liveness-probe-spec';
import { ScalingMetricsSpec, ScalingSpec } from '../common/scaling-spec';
import { ResourceConfig } from '../resource/resource-config';

export interface ServiceConfig extends ResourceConfig {
  getInterfaces(): Dictionary<InterfaceSpec>;
  setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  setInterface(key: string, value: InterfaceSpec | string): void;

  getDebugOptions(): ServiceConfig | undefined;
  setDebugOptions(value: ServiceConfig): void;

  getReplicas(): string;
  getLivenessProbe(): LivenessProbeSpec | undefined;
  getScaling(): ScalingSpec | undefined;
}
