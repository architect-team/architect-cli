import { Transform } from 'class-transformer/decorators';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { Dictionary } from '../../utils/dictionary';
import { ValidatableConfig } from '../base-spec';

export class BuildSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @IsString({ always: true })
  context?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform(value => {
    if (value) {
      if (!(value instanceof Object)) {
        return value;
      }
      const output: Dictionary<string> = {};
      for (const [k, v] of Object.entries(value)) {
        output[k] = `${v}`;
      }
      return output;
    }
  })
  args?: Dictionary<string>;

  @IsOptional({ always: true })
  @IsString({ always: true })
  dockerfile?: string;
}
