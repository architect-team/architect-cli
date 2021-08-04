import { IsBooleanString, IsEmpty, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Exclusive } from '../../utils/validators/exclusive';
import { ValidatableConfig } from '../base-spec';

//TODO:269:delete
export class VolumeSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @IsString({ always: true })
  mount_path?: string;

  @IsOptional({ groups: ['developer'] })
  @IsNotEmpty({
    groups: ['debug'],
    message: 'Debug volumes require a host path to mount the volume to',
  })
  @IsEmpty({
    groups: ['register'],
    message: 'Cannot hardcode a host mount path in a component outside of the debug block',
  })
  @IsString({ always: true })
  @Exclusive(['key'], { always: true, message: 'host_path and key are exclusive' })
  host_path?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  @Exclusive(['host_path'], { always: true, message: 'Key and host_path are exclusive' })
  key?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsBooleanString({ always: true })
  readonly?: string;
}
