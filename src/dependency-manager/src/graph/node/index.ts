import { Type } from 'class-transformer';
import { Parameter } from '../../manager';
import { DependencyState } from '../state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DependencyNodeOptions { }

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  abstract node_config: any;
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
    // TODO: TJ Do something better...
    if (!this._parameters) {
      this._parameters = {};
      if (!this.node_config?.getParameters) {
        return this._parameters;
      }

      for (const [key, value] of Object.entries(this.node_config.getParameters())) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        if ('default' in value) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
          // @ts-ignore
          this._parameters[key] = value.default;
        }
      }
    }
    return this._parameters;
  }

  get interfaces(): { [key: string]: any } {
    if (!this.node_config?.getInterfaces) {
      return {};
    }
    return this.node_config.getInterfaces();
  }

  get ports(): number[] {
    return Object.values(this.interfaces).map((i) => (i.port));
  }

  get protocol() {
    return '';
  }
}
