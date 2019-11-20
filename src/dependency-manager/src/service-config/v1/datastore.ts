import { Transform } from 'class-transformer';
import { Dict, Default } from '../../utils/transform';
import ServiceParameterV1 from './parameter';
import ServiceDatastore, { DockerConfig } from '../datastore';

export default class ServiceDatastoreV1 extends ServiceDatastore {
  host?: string;
  port?: string | number;
  image?: string;
  docker?: DockerConfig;
  @Transform(Dict(() => ServiceParameterV1, { key: 'value' }), { toClassOnly: true })
  @Default({})
  parameters: { [s: string]: ServiceParameterV1 } = {};

  isValid(): boolean {
    return Boolean(this.host || this.docker);
  }

  getDockerConfig(): DockerConfig {
    if (this.image) {
      if (!this.port){
        throw new Error('Missing datastore port which is required for provisioning');
      }
      return {
        image: this.image,
        target_port: this.port,
      };
    } else if (!this.docker) {
      throw new Error('Missing datastore docker config which is required for provisioning');
    }

    return this.docker;
  }
}
