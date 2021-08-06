import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ResourceSpec } from './resource-spec';

export class TaskSpec extends ResourceSpec {
  @IsOptional()
  @ValidateNested()
  debug?: TaskSpec;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  schedule?: string;
}
