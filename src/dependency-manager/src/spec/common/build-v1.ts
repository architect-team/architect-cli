import { Transform } from 'class-transformer';
import { IsObject, IsOptional, IsString } from 'class-validator';
import { Dictionary } from '../../utils/dictionary';
import { ValidatableConfig } from '../base-spec';

export class BuildSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @IsString({ always: true })
  context?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform(params => {
    if (params?.value) {
      if (!(params.value instanceof Object)) {
        return params.value;
      }
      const output: Dictionary<string> = {};
      for (const [k, v] of Object.entries(params.value)) {
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
