import { Type } from 'class-transformer';
import { ServiceInterfaceConfig } from '../../config/service-config';
import { Dictionary } from '../../utils/dictionary';
import { DependencyState } from '../state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DependencyNodeOptions { }

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;

  @Type(() => DependencyState)
  state?: DependencyState;

  abstract ref: string;

  abstract get interfaces(): Dictionary<ServiceInterfaceConfig>;

  instance_id = '';

  deployment_id?: string;

  proxy_port_mapping?: Dictionary<number>;

  get is_external(): boolean {
    return false;
  }

  get is_local(): boolean {
    return false;
  }
}
