import { ServiceConfig } from '../index';
import ServiceParameterV1 from './parameter';
import ServiceApiSpecV1 from './api-spec';
import ServiceDatastoreV1 from './datastore';
import ServiceSubscriptions from './subscriptions';
import { Transform } from 'class-transformer';
import { Dict, Default } from '../../utils/transform';
import ServiceParameter from '../parameter';
import ServiceDatastore from '../datastore';
import ServiceApiSpec from '../api-spec';

export class ServiceConfigV1 extends ServiceConfig {
  name = '';
  description?: string;
  keywords?: string[];
  dependencies: { [s: string]: string } = {};
  language?: string;
  subscriptions?: ServiceSubscriptions;
  debug?: string;
  @Transform(Dict(() => ServiceParameterV1, { key: 'value' }), { toClassOnly: true })
  @Default({})
  parameters: { [s: string]: ServiceParameterV1 } = {};
  @Transform(Dict(() => ServiceDatastoreV1, { key: 'value' }), { toClassOnly: true })
  @Default({})
  datastores: { [s: string]: ServiceDatastoreV1 } = {};
  @Default({ type: 'rest' })
  api: ServiceApiSpecV1 = { type: 'rest' };

  getName(): string {
    return this.name;
  }

  getApiSpec(): ServiceApiSpec {
    return this.api;
  }

  getDependencies(): { [s: string]: string } {
    return this.dependencies || {};
  }

  getParameters(): { [s: string]: ServiceParameter } {
    return this.parameters;
  }

  getDatastores(): { [s: string]: ServiceDatastore } {
    return this.datastores;
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
