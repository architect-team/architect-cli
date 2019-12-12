import { Type } from 'class-transformer';
import { DatastoreValueFromParameter, ValueFromParameter } from '../../manager';

export interface DependencyNodeOptions {
  host?: string;
  ports: {
    target: number;
    expose: number;
  };
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter };
}

class DependencyState {
  action: ('create' | 'delete' | 'update' | 'no-op') = 'no-op';
  applied_at?: Date;
  failed_at?: Date;
}

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  host = '0.0.0.0';
  ports!: { target: number; expose: number };
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter } = {};
  @Type(() => DependencyState)
  state?: DependencyState;

  protected constructor(options: DependencyNodeOptions) {
    if (options) {
      Object.assign(this, options);
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
