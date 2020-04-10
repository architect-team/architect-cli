import { Transform, Type } from 'class-transformer';
import { DatastoreValueFromParameter, ValueFromParameter, VaultParameter } from '../../manager';
import { DependencyState } from '../state';

interface Ports {
  target: number;
  expose: number;
}

export interface DependencyNodeOptions {
  ports: Ports[];
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter | VaultParameter };
}

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;

  @Transform(value => (value instanceof Array ? value : [value]))
  ports!: Ports[];
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter | VaultParameter } = {};

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
