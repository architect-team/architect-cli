import { Type } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { DependencyState } from '../state';

export default class DependencyEdge {
  from: string;
  to: string;
  interfaces_map: Dictionary<string>;

  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string, interfaces_map: Dictionary<string>) {
    this.from = from;
    this.to = to;
    this.interfaces_map = interfaces_map;
  }

  toString() {
    return `${this.from} [${Object.keys(this.interfaces_map).join(', ')}] -> ${this.to} [${Object.values(this.interfaces_map).join(', ')}]`;
  }

  get ref() {
    return `${this.from}.${this.to}`;
  }
}
