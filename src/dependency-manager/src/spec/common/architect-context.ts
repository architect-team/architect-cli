import { InterfaceSpec } from '../..';
import { Dictionary } from '../../utils/dictionary';

export interface ArchitectContext {
  environment: {
    ingresses: Dictionary<Dictionary<InterfaceSpec>>
  }
}
