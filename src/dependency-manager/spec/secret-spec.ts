import { IsOptional } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { AnyOf, ExpressionOr } from './utils/json-schema-annotations';

export type SecretSpecValue = Array<boolean | number | string> | boolean | number | string | null | undefined;

@JSONSchema({
  description: 'Components can define configurable secrets that can be used to enrich the contained services with environment-specific information (i.e. environment variables).',
})
export class SecretDefinitionSpec {
  static readonly merge_key = 'default';

  @IsOptional()
  @JSONSchema({
    type: 'boolean',
    description: 'Denotes whether the secret is required.',
  })
  required?: boolean;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A human-friendly description of the secret.',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(AnyOf('array', 'boolean', 'number', 'object', 'string', 'null')),
    description: 'Sets a default value for the secret if one is not provided',
  })
  default?: SecretSpecValue;
}
