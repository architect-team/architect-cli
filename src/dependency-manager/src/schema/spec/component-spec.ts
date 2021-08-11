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
  description?: string;

  @IsOptional()
  @JSONSchema(ArrayOf('string'))
  keywords?: string[];

  @IsOptional()
  @JSONSchema({ type: 'string' })
  author?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
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
}
