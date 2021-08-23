import { Allow, IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from '../utils/json-schema-annotations';
import { ComponentSlugUtils } from '../utils/slugs';
import { ServiceSpec } from './service-spec';
import { TaskSpec } from './task-spec';

export class IngressSpec {
  @IsOptional()
  @JSONSchema({ type: 'boolean' })
  enabled?: boolean;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  subdomain?: string;
}

export class ComponentInterfaceSpec {
  @IsOptional()
  @ValidateNested()
  ingress?: IngressSpec;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  host?: string;

  @IsOptional()
  @JSONSchema(AnyOf('number', 'string'))
  port?: number | string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  protocol?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  username?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  password?: string;

  @Allow()
  @JSONSchema({ type: 'string' })
  url!: string;

  @IsOptional()
  @JSONSchema(AnyOf('boolean', 'string'))
  sticky?: boolean | string;
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

@JSONSchema({
  description: 'The top level object of the architect.yml; defines a deployable Architect Component.',
})
export class ComponentSpec {
  @Matches(new RegExp(`^${ComponentSlugUtils.RegexBase}$`))
  @JSONSchema({
    type: 'string',
    description: 'Globally unique friendly reference to the component. Must only include letters, numbers, and dashes. Must be prefixed with a valid account name (e.g. architect/component-name).',
  })
  name!: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A human-readable description of the component. This will be rendered when potential consumers view the component so that they know what it should be used for.',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    ...ArrayOf('string'),
    description: 'Additional search terms to be used when the component is indexed so that others can find it more easily.',
  })
  keywords?: string[];

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The name or handle of the author of the component as a developer contact.',
  })
  author?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The url that serves as the informational homepage of the component (i.e. a github repo).',
  })
  homepage?: string;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOfAny('string', 'number', 'boolean', ParameterDefinitionSpec, 'null'),
    description: 'A map of named, configurable fields for the component. If a component contains properties that differ across environments (i.e. environment variables), you\'ll want to capture them as parameters.',
  })
  parameters?: Dictionary<string | number | boolean | ParameterDefinitionSpec | null>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOf(ServiceSpec),
    description: 'A map of named runtimes (e.g. daemons, servers, etc.) included with the component. Each service is independently deployable and scalable. Services are generally 1:1 with a docker image.',
  })
  services?: Dictionary<ServiceSpec>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOf(TaskSpec),
    description: 'A map of named recurring runtimes (e.g. crons, schedulers, triggered jobs) included with the component. Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are generally 1:1 with a docker image.',
  })
  tasks?: Dictionary<TaskSpec>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOf('string'),
    description: 'A key-value store of dependencies and their respective tags. Reference each dependency by component name (e.g. `architect/cloud: latest`)',
  })
  dependencies?: Dictionary<string>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOfAny('string', ComponentInterfaceSpec),
    description: 'A map of named gateways that broker access to the services inside the component. All network traffic within a component is locked down to the component itself, unless included in this interfaces block. An interface represents a front-door to your component, granting access to upstream callers.',
  })
  interfaces?: Dictionary<string | ComponentInterfaceSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    deprecated: true,
  })
  artifact_image?: string;
}
