import { IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from '../json-schema-annotations';

export class DeployModuleSpec {
  @IsString()
  @JSONSchema({ type: 'string' })
  path!: string;

  @IsObject()
  @JSONSchema(DictionaryOf('string'))
  inputs!: Dictionary<string>;
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

  // TODO:269:jsonschema (key || hostpath || neither)
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

export class BuildSpec {
  // TODO:269:jsonschema (context || dockerfile)
  @IsOptional()
  @JSONSchema({ type: 'string' })
  context?: string;

  @IsOptional()
  @JSONSchema(DictionaryOf('string'))
  args?: Dictionary<string>;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  dockerfile?: string;
}

export class ResourceSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  @Matches(/^[a-zA-Z0-9-_]+$/, { message: 'Names must only include letters, numbers, dashes, and underscores' }) //TODO:269: move match to description
  name?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  image?: string;

  @IsOptional()
  @JSONSchema({
    anyOf: [
      {
        type: "array",
        items: {
          type: 'string',
        },
      },
      {
        type: 'string',
      },
    ],
  })
  command?: string | string[];

  @IsOptional()
  @JSONSchema({
    anyOf: [
      {
        type: "array",
        items: {
          type: 'string',
        },
      },
      {
        type: 'string',
      },
    ],
  })
  entrypoint?: string | string[];

  @IsOptional()
  @JSONSchema({ type: 'string' })
  language?: string;

  @IsOptional()
  @ValidateNested()
  debug?: ResourceSpec;

  @IsOptional()
  @JSONSchema(DictionaryOf('string'))
  environment?: Dictionary<string>;

  @IsOptional()
  @JSONSchema(DictionaryOfAny(VolumeSpec, 'string'))
  volumes?: Dictionary<VolumeSpec | string>;

  @IsOptional()
  @ValidateNested()
  build?: BuildSpec;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  cpu?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  memory?: string;

  @IsOptional()
  @ValidateNested()
  deploy?: DeploySpec;

  @IsOptional()
  @JSONSchema(ArrayOf('string'))
  depends_on?: string[];

  // TODO:269:jsonschema (keys:${Slugs.LabelSlugDescription} && values:${Slugs.LabelSlugDescription}
  @IsOptional()
  labels?: Map<string, string>;
}
