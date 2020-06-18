import { Type } from 'class-transformer';
import { DependencyState } from '../state';

export default class DependencyEdge {
  from: string;
  to: string;
  interfaces: string[];

  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string, interfaces: string[]) {
    this.from = from;
    this.to = to;
    this.interfaces = interfaces;
  }

  get ref() {
    return `${this.from}.${this.to}.${this.interfaces.join('.')}`;
  }
}
