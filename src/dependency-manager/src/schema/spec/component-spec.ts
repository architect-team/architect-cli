import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { ComponentSlugUtils } from '../../utils/slugs';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from '../json-schema-annotations';
import { InterfaceSpec, ServiceSpec } from './service-spec';
import { TaskSpec } from './task-spec';

export class IngressSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  subdomain?: string;
}

export class ComponentInterfaceSpec extends InterfaceSpec {
  @IsOptional()
  @ValidateNested()
  ingress?: IngressSpec;
}

export class ParameterDefinitionSpec {
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

export class ComponentSpec {
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
  @JSONSchema(DictionaryOfAny('string', 'number', 'boolean', ParameterDefinitionSpec))
  parameters?: Dictionary<string | number | boolean | ParameterDefinitionSpec>;

  @IsOptional()
  @JSONSchema(DictionaryOf(ServiceSpec))
  services?: Dictionary<ServiceSpec>;

  @IsOptional()
  @JSONSchema(DictionaryOf(TaskSpec))
  tasks?: Dictionary<TaskSpec>;

  @IsOptional()
  @JSONSchema(DictionaryOf('string'))
  dependencies?: Dictionary<string>;

  @IsOptional()
  @JSONSchema(DictionaryOfAny('string', ComponentInterfaceSpec))
  interfaces?: Dictionary<string | ComponentInterfaceSpec>;

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
