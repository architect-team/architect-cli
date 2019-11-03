import ServiceParameterConfig from './parameter';
import ServiceApiConfig from './api';
import ServiceDatastoreConfig from './datastore';
import ServiceSubscriptions from './subscriptions';
import ServiceDebugConfig from './debug';
import { Transform } from 'class-transformer';
import { Dict, Default } from '../utils/transform';

export default class ServiceConfig {
  name: string;
  description?: string;
  keywords?: string[];
  dependencies: { [s: string]: string } = {};
  @Transform(Dict(() => ServiceParameterConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  parameters: { [s: string]: ServiceParameterConfig } = {};
  @Transform(Dict(() => ServiceDatastoreConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  datastores: { [s: string]: ServiceDatastoreConfig } = {};
  api?: ServiceApiConfig;
  language?: string;
  subscriptions?: ServiceSubscriptions;
  debug?: string;

  constructor(partial?: Partial<ServiceConfig>) {
    Object.assign(this, partial);
  }

  getDependencies(): { [s: string]: string } {
    return this.dependencies || {};
  }

  isValid(): boolean {
    return Boolean(
      this.name &&
      this.language &&
      (
        !this.datastores ||
        Object.keys(this.datastores)
          .every(key => this.datastores[key].isValid())
      )
    );
  }
}
