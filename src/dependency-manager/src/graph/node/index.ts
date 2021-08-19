import { Type } from 'class-transformer';
import { ServiceInterfaceConfig } from '../../schema/config/service-config';
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

  get is_external() {
    return false;
  }

  get is_local() {
    return false;
  }
}
