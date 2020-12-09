import { Type } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { DependencyState } from '../state';

export default class DependencyEdge {
  from: string;
  to: string;
  interfaces_map: Dictionary<Set<string>>; // NOTE: be careful if debugging this. using JSON.stringify(<any_set>, null, 2) will print as {} which is expected. this does not mean that it has no values

  @Type(() => DependencyState)
  state?: DependencyState;

  constructor(from: string, to: string, interfaces_map: Dictionary<Set<string>>) {
    this.from = from;
    this.to = to;
    this.interfaces_map = interfaces_map;
  }

  toString() {
    let interface_map_values: string[] = [];
    for (const value of Object.values(this.interfaces_map)) {
      interface_map_values = interface_map_values.concat(Array.from(value));
    }
    return `${this.from} [${Object.keys(this.interfaces_map).join(', ')}] -> ${this.to} [${interface_map_values.join(', ')}]`;
  }

  get ref() {
    return `${this.from}.${this.to}`;
  }
}
