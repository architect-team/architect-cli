import { Type } from 'class-transformer';
import { InterfaceSpec } from '../../service-config/base';
import { Dictionary } from '../../utils/dictionary';
import { DependencyState } from '../state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DependencyNodeOptions { }

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;

  @Type(() => DependencyState)
  state?: DependencyState;

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  //TODO:87:consolidate with normalized_ref
  get namespace_ref() {
    return this.normalized_ref.replace(/\./g, '_').replace(/-/g, '_');
  }

  abstract ref: string;

  abstract get interfaces(): Dictionary<InterfaceSpec>;

  get is_external() {
    return false;
  }

  get is_local() {
    return false;
  }
}
