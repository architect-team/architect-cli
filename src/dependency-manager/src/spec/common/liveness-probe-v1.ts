import { Type } from 'class-transformer/decorators';
import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { Exclusive } from '../../utils/validators/exclusive';
import { ValidatableConfig } from '../base-spec';

export class LivenessProbeV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @Type(() => String)
  success_threshold?: string;

  @IsOptional({ always: true })
  @Type(() => String)
  failure_threshold?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  timeout?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  interval?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  initial_delay?: string;

  @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['command'], { always: true, message: 'Path with port and command are exclusive' })
  @IsString({ always: true })
  path?: string;

  @ValidateIf(obj => !obj.path || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['path', 'port'], { always: true, message: 'Command and path with port are exclusive' })
  @IsString({ always: true, each: true })
  command?: string[] | string;

  @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['command'], { always: true, message: 'Command and path with port are exclusive' })
  @IsNotEmpty({ always: true })
  @Type(() => String)
  port?: string;
}
