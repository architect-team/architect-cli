import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { Slugs } from '../../utils/slugs';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny, StringOrStringArray } from '../json-schema-annotations';

export class DeployModuleSpec {
  @IsString()
  @JSONSchema({ type: 'string' })
  path!: string;

  @IsObject()
  @JSONSchema(DictionaryOfAny('string', 'null'))
  inputs!: Dictionary<string | null>;
}

export class DeploySpec {
  @IsString()
  @JSONSchema({ type: 'string' })
  strategy!: string;

  @IsObject()
  @JSONSchema(DictionaryOf(DeployModuleSpec))
  modules!: Dictionary<DeployModuleSpec>;
}

export class VolumeSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  mount_path?: string;

  // TODO:289: (key || hostpath || neither)
  @IsOptional()
  @JSONSchema({ type: 'string' })
  host_path?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  key?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema(AnyOf('boolean', 'string'))
  readonly?: boolean | string;
}

export type EnvironmentSpecValue = boolean | null | number | string;
export const EnvironmentDictiory = DictionaryOfAny('boolean', 'null', 'number', 'string');

export class BuildSpec {
  // TODO:289: (context || dockerfile)
  @IsOptional()
  @JSONSchema({ type: 'string' })
  context?: string;

  @IsOptional()
  @JSONSchema(DictionaryOfAny('string', 'null'))
  args?: Dictionary<string | null>;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  dockerfile?: string;
}

export class ResourceSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  image?: string;

  @IsOptional()
  @JSONSchema(StringOrStringArray())
  command?: string | string[];

  @IsOptional()
  @JSONSchema(StringOrStringArray())
  entrypoint?: string | string[];

  @IsOptional()
  @JSONSchema({ type: 'string' })
  language?: string;

  @IsOptional()
  @ValidateNested()
  debug?: ResourceSpec;

  @IsOptional()
  @JSONSchema(EnvironmentDictiory)
  environment?: Dictionary<EnvironmentSpecValue>;

  @IsOptional()
  @JSONSchema(DictionaryOfAny(VolumeSpec, 'string'))
  volumes?: Dictionary<VolumeSpec | string>;

  @IsOptional()
  @ValidateNested()
  build?: BuildSpec;

  @IsOptional()
  @JSONSchema(AnyOf('number', 'string'))
  cpu?: number | string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  memory?: string;

  @IsOptional()
  @ValidateNested()
  deploy?: DeploySpec;

  @IsOptional()
  @JSONSchema(ArrayOf('string'))
  depends_on?: string[];

  @IsOptional()
  @JSONSchema({
    type: "object",
    patternProperties: {
      [Slugs.LabelKeySlugValidatorString]: {
        type: "string",
        pattern: Slugs.LabelValueSlugValidatorString,
      },
    },
    additionalProperties: false,
  })
  labels?: Map<string, string>;
}
