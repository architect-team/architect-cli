import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from '../json-schema-annotations';

export class DeployModuleSpec {
  @JSONSchema({ type: 'string' })
  path!: string;

  @JSONSchema(DictionaryOf('string'))
  inputs!: Dictionary<string>;
}

export class DeploySpec {
  @JSONSchema({ type: 'string' })
  strategy!: string;

  @JSONSchema(DictionaryOf(DeployModuleSpec))
  modules!: Dictionary<DeployModuleSpec>;
}

export class VolumeSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  mount_path?: string;

  // TODO:269:next: exclusive OR across properties
  // @Exclusive(['key'], { always: true, message: 'host_path and key are exclusive' })
  @IsOptional()
  @JSONSchema({ type: 'string' })
  host_path?: string;

  // TODO:269:next: exclusive OR across properties
  // @Exclusive(['host_path'], { always: true, message: 'Key and host_path are exclusive' })
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
  // @ValidateIf(o => o.context || o.dockerfile, )
  // TODO:269:next: exclusive OR across properties
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

  @JSONSchema({ type: 'string' })
  language!: string; //TODO:269:? double check to make sure this was required for good reason. was throwing an Error in the getter if not set.

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

  // TODO:269:special case: key/value matching
  // @IsOptional()
  // @IsObject()
  // @MatchesKeys(Slugs.LabelKeySlugValidator, { always: true, message: `prefix must be lowercase and is optional, each <prefix>/<key> ${Slugs.LabelSlugDescription}` })
  // @MatchesValues(Slugs.LabelValueSlugValidator, { always: true, message: `each value ${Slugs.LabelSlugDescription}` })
  labels?: Map<string, string>;
}
