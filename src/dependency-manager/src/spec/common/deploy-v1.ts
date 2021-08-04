import { IsObject, IsString } from 'class-validator';
import { Dictionary } from '../../utils/dictionary';
import { ValidatableConfig } from '../base-spec';

//TODO:269:delete
export class DeployModuleSpecV1 extends ValidatableConfig {
  @IsString({ always: true })
  path!: string;

  @IsObject({ always: true })
  inputs!: Dictionary<string>;
}

//TODO:269:delete
export class DeploySpecV1 extends ValidatableConfig {
  @IsString({ always: true })
  strategy!: string;

  @IsObject({ always: true })
  modules!: Dictionary<DeployModuleSpecV1>;
}
