
import { ComponentConfig } from '../config/component-config';
import { DependencyGraph } from '../graph';
import type { DependencyManager } from '../manager';

export abstract class DeprecatedSpec {
  protected manager: DependencyManager;
  constructor(manager: DependencyManager) {
    this.manager = manager;
  }

  public abstract shouldRun(component_configs: ComponentConfig[]): boolean;
  public abstract transformGraph(graph: DependencyGraph, component_configs: ComponentConfig[]): void;
}
