import { Exclude, Type } from 'class-transformer';
import { ParameterValue } from '../../service-config/base';
import { DependencyState } from '../state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DependencyNodeOptions { }

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  @Exclude()
  protected _parameters?: { [key: string]: ParameterValue };

  @Type(() => DependencyState)
  state?: DependencyState;

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  //TODO:76:consolidate with normalized_ref and find
  get namespace_ref() {
    return this.normalized_ref.replace(/\./g, '_').replace(/-/g, '_');
  }

  abstract get ref(): string;

  get parameters(): { [key: string]: ParameterValue } {
    if (!this._parameters) {
      this._parameters = {};
    }
    return this._parameters;
  }

  abstract get interfaces(): { [key: string]: any };

  get ports(): number[] {
    return Object.values(this.interfaces).map((i) => (i.port));
  }

  get protocol() {
    return '';
  }
}
