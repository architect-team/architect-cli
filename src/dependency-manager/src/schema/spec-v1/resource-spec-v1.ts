import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from '../json-schema-annotations';

export class DeployModuleSpecV1 {
  @JSONSchema({ type: 'string' })
  path!: string;

  @JSONSchema(DictionaryOf('string'))
  inputs!: Dictionary<string>;
}

export class DeploySpecV1 {
  @JSONSchema({ type: 'string' })
  strategy!: string;

  @JSONSchema(DictionaryOf(DeployModuleSpecV1))
  modules!: Dictionary<DeployModuleSpecV1>;
}

export class VolumeSpecV1 {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  mount_path?: string;

  // TODO:269:validation
  // @IsNotEmpty({
  //   groups: ['debug'],
  //   message: 'Debug volumes require a host path to mount the volume to',
  // })
  // @IsEmpty({
  //   groups: ['register'],
  //   message: 'Cannot hardcode a host mount path in a component outside of the debug block',
  // })
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

export class BuildSpecV1 {
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

export class ResourceSpecV1 {
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
  language!: string; //TODO:269: double check to make sure this was required for good reason. was throwing an Error in the getter if not set.

  @IsOptional()
  @ValidateNested()
  debug?: ResourceSpecV1;

  @IsOptional()
  @JSONSchema(DictionaryOf('string'))
  environment?: Dictionary<string>;

  @IsOptional()
  @JSONSchema(DictionaryOfAny(VolumeSpecV1, 'string'))
  volumes?: Dictionary<VolumeSpecV1 | string>;

  @IsOptional()
  @ValidateNested()
  build?: BuildSpecV1;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  cpu?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  memory?: string;

  @IsOptional()
  @ValidateNested()
  deploy?: DeploySpecV1;

  @IsOptional()
  @JSONSchema(ArrayOf('string'))
  depends_on?: string[];

  // TODO:269:special case: key/value matching
  // @IsOptional()
  // @IsObject()
  // @MatchesKeys(Slugs.LabelKeySlugValidator, { always: true, message: `prefix must be lowercase and is optional, each <prefix>/<key> ${Slugs.LabelSlugDescription}` })
  // @MatchesValues(Slugs.LabelValueSlugValidator, { always: true, message: `each value ${Slugs.LabelSlugDescription}` })
  labels?: Map<string, string>;

  // TODO:269:validation
  // async validate(options?: ValidatorOptions) {
  //   if (!options) { options = {}; }
  //   let errors = await super.validate(options);
  //   if (errors.length) return errors;
  //   const expanded = this.expand();
  //   errors = await validateNested(expanded, 'debug', errors, { ...options, groups: (options.groups || []).concat('debug') });
  //   errors = await validateNested(expanded, 'liveness_probe', errors, options);
  //   // Hack to overcome conflicting IsEmpty vs IsNotEmpty with developer vs debug
  //   const volumes_options = { ...options };
  //   if (volumes_options.groups && volumes_options.groups.includes('debug')) {
  //     volumes_options.groups = ['debug'];
  //   }
  //   errors = await validateDictionary(expanded, 'environment', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
  //   errors = await validateDictionary(expanded, 'volumes', errors, undefined, volumes_options, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
  //   errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
  //   return errors;
  // }
}
