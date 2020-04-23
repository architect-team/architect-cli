import { IsBoolean, IsInstance, IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../../base-spec';
import { validateNested } from '../../utils/validation';

export class DockerComposeSpecV1 extends BaseSpec {
  @IsOptional()
  @IsBoolean()
  privileged?: boolean;

  @IsOptional()
  @IsString()
  stop_signal?: string;
}

export class PlatformsSpecV1 extends BaseSpec {
  @IsOptional()
  @IsInstance(DockerComposeSpecV1)
  'docker-compose'?: DockerComposeSpecV1;

  constructor(plain?: any) {
    super(plain);

    if (this['docker-compose']) {
      this['docker-compose'] = new DockerComposeSpecV1(this['docker-compose']);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'docker-compose', errors);
    return errors;
  }
}