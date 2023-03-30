import { ComponentConfig } from '../../dependency-manager/config/component-config';
import { Component } from './component.entity';

export default interface ComponentVersion {
  created_at: string;
  tag: string;
  config: ComponentConfig;
  component: Component;
}
