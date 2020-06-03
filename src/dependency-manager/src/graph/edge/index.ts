import { Type } from 'class-transformer';
import { DependencyState } from '../state';

export default class DependencyEdge {
  from: string;
  to: string;
  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string) {
    this.from = from;
    this.to = to;
  }

  get ref() {
    return `${this.from}.${this.to}`;
  }
}
