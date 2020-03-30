import { Type } from 'class-transformer';
import { DatastoreValueFromParameter, ValueFromParameter } from '../../manager';
import { DependencyState } from '../state';

export interface ports {
  target: number;
  expose: number;
}

export interface DependencyNodeOptions {
  ports: ports[];
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter };
}

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  ports!: ports[];
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter } = {};
  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(options: DependencyNodeOptions) {
    if (options) {
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
