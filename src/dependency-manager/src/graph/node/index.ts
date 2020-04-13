import { Exclude, Type } from 'class-transformer';
import { Parameter } from '../../manager';
import { DependencyState } from '../state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DependencyNodeOptions { }

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  @Exclude()
  protected _parameters?: { [key: string]: Parameter };

  @Type(() => DependencyState)
  state?: DependencyState;

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  abstract get env_ref(): string;
  abstract get ref(): string;

  get parameters(): { [key: string]: Parameter } {
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
