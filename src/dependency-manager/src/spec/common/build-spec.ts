import { Dictionary } from '../../utils/dictionary';

export interface BuildSpec {
  context?: string;
  args?: Dictionary<string>;
  dockerfile?: string;
}
