import { Type } from 'class-transformer';
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

  abstract get interfaces(): { [key: string]: any };

  get ports(): number[] {
    const ports = Object.values(this.interfaces).map((i) => (i.port));
    return [...new Set(ports)];
  }

  get is_external() {
    return Object.keys(this.interfaces).length > 0 && Object.values(this.interfaces).every((i) => i.host);
  }

  get is_local() {
    return false;
  }
}
