/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import { ServiceConfig } from './base';
import { ServiceConfigV1 } from './v1';

export class ServiceConfigBuilder {
  static buildFromJSON(obj: object): ServiceConfig {
    return plainToClass(ServiceConfigV1, obj);
  }
}
