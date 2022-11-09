import { Type } from 'class-transformer';
import { DependencyState } from '../state';

export abstract class DependencyEdge {
  abstract __type: string;

  from: string;
  to: string;
  interface_to: string;

  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string, interface_to: string) {
    this.from = from;
    this.to = to;
    this.interface_to = interface_to;
  }

  instance_id = '';

  toString(): string {
    return `${this.from} -> ${this.to}[${this.interface_to}]`;
  }

  get ref(): string {
    return `${this.from}.${this.to}.${this.interface_to}`;
  }
}
