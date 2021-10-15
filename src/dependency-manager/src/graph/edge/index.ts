import { Type } from 'class-transformer';
import { DependencyState } from '../state';

export default abstract class DependencyEdge {
  abstract __type: string;

  from: string;
  to: string;
  interface_mappings: { interface_from: string, interface_to: string }[];

  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string, interface_mappings: { interface_from: string, interface_to: string }[]) {
    this.from = from;
    this.to = to;
    this.interface_mappings = interface_mappings;
  }

  instance_id = '';

  toString(): string {
    return `${this.from} [${this.interface_mappings.map(i => i.interface_from).join(', ')}] -> ${this.to} [${this.interface_mappings.map(i => i.interface_to).join(', ')}]`;
  }

  get ref(): string {
    return `${this.from}.${this.to}.${this.__type}`;
  }
}
