import { Type } from 'class-transformer';
import { DatastoreValueFromParameter, ValueFromParameter } from '../../manager';
import { DependencyState } from '../state';

export interface DependencyNodeOptions {
  host?: string;
  ports: {
    target: number;
    expose: number;
  };
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter };
}

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  host!: string;
  ports!: { target: number; expose: number };
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter } = {};
  @Type(() => DependencyState)
  state?: DependencyState;

  protected constructor(options: DependencyNodeOptions) {
    if (options) {
      this.host = options.host || '0.0.0.0';
      this.ports = options.ports;
      this.parameters = options.parameters || {};
    }
  }

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  abstract get env_ref(): string;
  abstract get ref(): string;

  get protocol() {
    return '';
  }
}
