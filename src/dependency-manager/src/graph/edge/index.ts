import { Type } from 'class-transformer';
import { DependencyState } from '../state';

export default abstract class DependencyEdge {
  abstract __type: string;
  from: string;
  to: string;
  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string) {
    this.from = from;
    this.to = to;
  }

  get ref() {
    return `${this.__type}.${this.from}.${this.to}`;
  }
}
