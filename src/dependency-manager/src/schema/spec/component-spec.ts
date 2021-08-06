import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { ComponentSlugUtils } from '../../utils/slugs';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from '../json-schema-annotations';
import { InterfaceSpecV1, ServiceSpecV1 } from './service-spec';
import { TaskSpecV1 } from './task-spec';

// TODO:269: kill versions from naming
export class IngressSpecV1 {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  subdomain?: string;
}

export class ComponentInterfaceSpecV1 extends InterfaceSpecV1 {
  @IsOptional()
  @ValidateNested()
  ingress?: IngressSpecV1;
}

export class ParameterDefinitionSpecV1 {
  @IsOptional()
  @JSONSchema({ type: 'boolean' })
  required?: boolean;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema(AnyOf('boolean', 'number', 'string', 'null'))
  default?: boolean | number | string | null;
}

export class ComponentSpecV1 {
  @Matches(new RegExp(`^${ComponentSlugUtils.RegexBase}$`), {
    message: 'Names must only include letters, numbers, and dashes. Names must be prefixed with an account name (e.g. architect/component-name).',
    groups: ['developer'],
  })
  @JSONSchema({ type: 'string' })
  name!: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  tag?: string;

  @IsOptional()
  @Matches(/^(?!file:).*$/g) // TODO:269:factor out into a constant
  @JSONSchema({ type: 'string' })
  extends?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema(ArrayOf('string'))
  keywords?: string[];

  @IsOptional()
  @JSONSchema({ type: 'string' })
  author?: string;

  @IsOptional()
  @JSONSchema({ type: 'string', format: 'url' })
  homepage?: string;

  @IsOptional()
  @JSONSchema(DictionaryOfAny('string', 'number', 'boolean', ParameterDefinitionSpecV1))
  parameters?: Dictionary<string | number | boolean | ParameterDefinitionSpecV1>;

  @IsOptional()
  @JSONSchema(DictionaryOf(ServiceSpecV1))
  services?: Dictionary<ServiceSpecV1>;

  @IsOptional()
  @JSONSchema(DictionaryOf(TaskSpecV1))
  tasks?: Dictionary<TaskSpecV1>;

  @IsOptional()
  @JSONSchema(DictionaryOf('string'))
  dependencies?: Dictionary<string>;

  @IsOptional()
  @JSONSchema(DictionaryOfAny('string', ComponentInterfaceSpecV1))
  interfaces?: Dictionary<string | ComponentInterfaceSpecV1>;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  artifact_image?: string;

  // TODO:269:validation
  // async validate(options?: ValidatorOptions) {
  //   if (!options) options = {};
  //   const groups = [...options.groups || []];

  //   if (!(groups || []).includes('deploy')) {  // Deploy already does component interpolation validation
  //     try {
  //       const context = this.getContext();
  //       for (const [parameter_key, parameter_value] of Object.entries(this.getParameters())) {
  //         if (parameter_value.default === null || parameter_value.default === undefined) {
  //           context.parameters[parameter_key] = '1';
  //         }
  //       }
  //       const expanded = this.expand();
  //       const interpolated_string = interpolateString(serialize(expanded), context, ['architect.', 'dependencies.', 'environment.']);
  //       const interpolated_config = deserialize(expanded.getClass(), interpolated_string) as ComponentConfig;
  //       return interpolated_config.validate({ ...options, groups: groups.concat('deploy') });
  //     } catch (err) {
  //       if (err instanceof ValidationError) {
  //         return [err];
  //       } else {
  //         throw err;
  //       }
  //     }
  //   }

  //   let errors = await super.validate(options);
  //   if (errors.length) return errors;

  //   const expanded = this.expand();
  //   errors = await validateDictionary(expanded, 'parameters', errors, undefined, options, new RegExp(`^${Slugs.ComponentParameterRegexBase}$`));
  //   errors = await validateDictionary(expanded, 'services', errors, undefined, { ...options, groups: groups.concat('component') }, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
  //   errors = await validateDictionary(expanded, 'tasks', errors, undefined, { ...options, groups: groups.concat('component') }, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
  //   errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
  //   errors = await validateCrossDictionaryCollisions(expanded, 'services', 'tasks', errors); // makes sure services and tasks don't have any common keys
  //   errors = await validateDependsOn(expanded, errors); // makes sure service depends_on refers to valid other services

  //   return errors;
  // }
}
