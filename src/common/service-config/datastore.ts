import { Transform } from 'class-transformer';
import { Default, Dict } from '../utils/transform';
import ServiceParameterConfig from './parameter';

interface DockerConfig {
  image: string;
  target_port: string | number;
}

export default class ServiceDatastoreConfig {
  host?: string;
  port?: string | number;
  image?: string;
  docker?: DockerConfig;
  @Transform(Dict(() => ServiceParameterConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  parameters: { [s: string]: ServiceParameterConfig } = {};

  isValid(): boolean {
    return Boolean(this.host || this.docker);
  }

  getDockerConfig(): DockerConfig {
    if (this.image) {
      if (!this.port) {
        throw new Error('Missing datastore port which is required for docker provisioning');
      }
      return {
        image: this.image,
        target_port: this.port,
      };
    } else if (!this.docker) {
      throw new Error('Missing datastore docker config which is required for local provisioning');
    }

    return this.docker;
  }
}
