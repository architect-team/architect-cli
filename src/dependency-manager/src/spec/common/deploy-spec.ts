import { Dictionary } from '../../utils/dictionary';

export interface DeployModuleSpec {
  path: string;
  inputs: Dictionary<string>;
}

export interface DeploySpec {
  strategy: string;
  modules: Dictionary<DeployModuleSpec>;
}
