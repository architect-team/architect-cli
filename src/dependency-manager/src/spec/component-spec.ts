import { Allow, IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { ServiceSpec } from './service-spec';
import { TaskSpec } from './task-spec';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny } from './utils/json-schema-annotations';
import { ComponentSlugUtils } from './utils/slugs';

@JSONSchema({
  description: 'An ingress exposes an interface to external network traffic through an architect-deployed gateway.',
})
export class IngressSpec {
  @IsOptional()
  @JSONSchema({
    type: 'boolean',
    description: 'Marks the interface as an ingress.',
  })
  enabled?: boolean;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The subdomain that will be used if the interface is exposed externally (defaults to the interface name)',
  })
  subdomain?: string;
}

@JSONSchema({
  description: 'Component Interfaces are the primary means by which components advertise their resolvable addresses to others. Interfaces are the only means by which other components can communicate with your component.',
})
export class ComponentInterfaceSpec {
  @IsOptional()
  @ValidateNested()
  ingress?: IngressSpec;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A human-readable description of the component. This will be rendered when potential consumers view the interface so that they know what it should be used for.',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The host that the component interface should forward to.',
  })
  host?: string;

  @IsOptional()
  @JSONSchema({
    ...AnyOf('number', 'string'),
    description: 'The port that the component interface should forward to.',
  })
  port?: number | string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The protocol by which the component interface can be connected to.',
  })
  protocol?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The Basic Auth username by which a component interface can be connected to.',
  })
  username?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The Basic Auth password by which a component interface can be connected to.',
  })
  password?: string;

  @Allow()
  @JSONSchema({
    type: 'string',
    description: 'The url that the component interface should forward to.',
  })
  url!: string;

  @IsOptional()
  @JSONSchema({
    ...AnyOf('boolean', 'string'),
    description: 'If this interface is made into an external ingress, sticky=true will denote the gateway should use sticky sessions if more than one replica is running.',
  })
  sticky?: boolean | string;
}

@JSONSchema({
  description: 'Components can define configurable parameters that can be used to enrich the contained services with environment-specific information (i.e. environment variables).',
})
export class ParameterDefinitionSpec {
  @IsOptional()
  @JSONSchema({
    type: 'boolean',
    description: 'Denotes whether the parameter is required.',
  })
  required?: boolean;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A human-friendly description of the parameter.',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    ...AnyOf('array', 'boolean', 'number', 'object', 'string', 'null'),
    description: 'Sets a default value for the parameter if one is not provided',
  })
  default?: boolean | number | object | string | null;
}

@JSONSchema({
  description: 'The top level object of the `architect.yml`; defines a deployable Architect Component.',
})
export class ComponentSpec {
  @Matches(new RegExp(`^${ComponentSlugUtils.RegexBase}$`))
  @JSONSchema({
    type: 'string',
    description: 'Globally unique friendly reference to the component. Must be prefixed with a valid Architect account and separated by a slash (e.g. architect/component-name). The following slug must be kebab-case: alphanumerics punctuated only by dashes.',
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
    description: 'A map of named, configurable fields for the component. If a component contains properties that differ across environments (i.e. environment variables), you\'ll want to capture them as parameters. Specifying a primitive value here will set the default parameter value. For more detailed configuration, specify a ParameterDefinitionSpec',
  })
  parameters?: Dictionary<string | number | boolean | ParameterDefinitionSpec | null>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOf(ServiceSpec),
    description: 'A Service represents a non-exiting runtime (e.g. daemons, servers, etc.). Each service is independently deployable and scalable. Services are 1:1 with a docker image.',
  })
  services?: Dictionary<ServiceSpec>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOf(TaskSpec),
    description: 'A set of named recurring and/or exiting runtimes (e.g. crons, schedulers, triggered jobs) included with the component. Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image.',
  })
  tasks?: Dictionary<TaskSpec>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOf('string'),
    description: 'A key-value set of dependencies and their respective tags. Reference each dependency by component name (e.g. `architect/cloud: latest`)',
  })
  dependencies?: Dictionary<string>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOfAny('string', ComponentInterfaceSpec),
    description: 'A set of named gateways that broker access to the services inside the component. All network traffic within a component is locked down to the component itself, unless included in this interfaces block. An interface represents a front-door to your component, granting access to upstream callers.',
  })
  interfaces?: Dictionary<string | ComponentInterfaceSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    deprecated: true,
    description: '-',
  })
  artifact_image?: string;
}
