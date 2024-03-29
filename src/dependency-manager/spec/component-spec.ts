
import { Exclude, Transform } from 'class-transformer';
import { Allow, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { DatabaseSpec } from './database-spec';
import { ResourceSpec } from './resource-spec';
import { SecretDefinitionSpec, SecretSpecValue } from './secret-spec';
import { IngressSpec, ServiceSpec } from './service-spec';
import { TaskSpec } from './task-spec';
import { transformObject } from './transform/common-transform';
import { EXPRESSION_REGEX } from './utils/interpolation';
import { AnyOf, ArrayOf, ExpressionOr, ExpressionOrString } from './utils/json-schema-annotations';
import { ComponentSlugUtils, Slugs } from './utils/slugs';

export interface ComponentInstanceMetadata {
  readonly tag: string;
  readonly ref: string;

  readonly instance_name?: string;
  readonly instance_id?: string;
  readonly instance_date: Date;

  file?: {
    path: string;
    folder: string;
    contents: string;
  }

  deprecated_interfaces_map: Dictionary<string | undefined>;

  interpolated?: boolean;
}

@JSONSchema({
  description: 'An empty object that optionally supports specifying a tag for backwards compatibility.',
})
export class DependencySpec {
  @IsOptional()
  @JSONSchema(
    ExpressionOr({
      type: 'string',
      pattern: Slugs.ComponentTagValidator.source,
      deprecated: true,
    }),
  )
  tag?: string;
}

@JSONSchema({
  description: 'Component Interfaces are the primary means by which components advertise their resolvable addresses to others. Interfaces are the only means by which other components can communicate with your component.',
})
export class ComponentInterfaceSpec {
  static readonly merge_key = 'url';

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
    ...ExpressionOr({ type: 'number' }),
    description: 'The port that the component interface should forward to.',
  })
  port?: number | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The protocol by which the component interface can be connected to.',
  })
  protocol?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The Basic Auth username by which a component interface can be connected to.',
  })
  username?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The Basic Auth password by which a component interface can be connected to.',
  })
  password?: string;

  @Allow()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The url that the component interface should forward to.',
  })
  url!: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'boolean' }),
    description: 'If this interface is made into an external ingress, sticky=true will denote the gateway should use sticky sessions if more than one replica is running.',
  })
  sticky?: boolean | string;
}

@JSONSchema({
  description: 'Components can define output fields that can be used to share configuration with consuming components.',
})
export class OutputDefinitionSpec {
  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A human-friendly description of the output field.',
  })
  description?: string;

  @Allow()
  @JSONSchema({
    description: 'Value of the output to be passed to upstream consumers',
  })
  value!: boolean | number | string | null;
}

@JSONSchema({
  description: 'The top level object of the `architect.yml`; defines a deployable Architect Component.',
})
export class ComponentSpec {
  @Exclude({ toPlainOnly: true })
  metadata!: ComponentInstanceMetadata;

  @IsString()
  @JSONSchema({
    type: 'string',
    pattern: ComponentSlugUtils.Validator.source,
    errorMessage: ComponentSlugUtils.Description,
    description: `Globally unique friendly reference to the component. ${ComponentSlugUtils.Description}`,
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
    type: 'object',
    patternProperties: {
      [Slugs.ComponentSecretValidator.source]: AnyOf('string', 'number', 'boolean', SecretDefinitionSpec, 'null'),
    },
    errorMessage: {
      additionalProperties: Slugs.ComponentSecretDescription,
    },
    description: 'A map of named, configurable fields for the component. If a component contains properties that differ across environments (i.e. environment variables), you\'ll want to capture them as secrets. Specifying a primitive value here will set the default secret value. For more detailed configuration, specify a SecretDefinitionSpec',
  })
  @Transform(transformObject(SecretDefinitionSpec))
  secrets?: Dictionary<SecretSpecValue | SecretDefinitionSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ComponentSecretValidator.source]: AnyOf('string', 'number', 'boolean', OutputDefinitionSpec, 'null'),
    },
    errorMessage: {
      additionalProperties: Slugs.ComponentSecretDescription,
    },
    description: 'A map of named, configurable outputs for the component. Outputs allow components to expose configuration details that should be shared with consumers, like API keys or notification topic names.',
  })
  @Transform(transformObject(OutputDefinitionSpec))
  outputs?: Dictionary<string | number | boolean | OutputDefinitionSpec | null>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: AnyOf(DatabaseSpec),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A database represents a stateful service powered by one of several supported database engines.',
  })
  databases?: Dictionary<DatabaseSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: AnyOf(ServiceSpec),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A Service represents a non-exiting runtime (e.g. daemons, servers, etc.). Each service is independently deployable and scalable. Services are 1:1 with a docker image.',
  })
  @Transform(transformObject(ServiceSpec))
  services?: Dictionary<ServiceSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: AnyOf(TaskSpec),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A set of named recurring and/or exiting runtimes (e.g. crons, schedulers, triggered jobs) included with the component. Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image.',
  })
  @Transform(transformObject(TaskSpec))
  tasks?: Dictionary<TaskSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'object',

    patternProperties: {
      [ComponentSlugUtils.Validator.source]: AnyOf({
        type: 'string',
        pattern: Slugs.ComponentTagValidator.source,
      }, {
        type: 'string',
        pattern: EXPRESSION_REGEX.source,
        errorMessage: {
          // __arc__ is replaced later to avoid json pointer issues with ajv
          pattern: 'must be an interpolation ref ex. $__arc__{{ secrets.example }}',
        },
      }, DependencySpec),
    },

    errorMessage: {
      additionalProperties: ComponentSlugUtils.Description,
    },

    description: 'A key-value set of dependencies with an empty value. Reference each dependency by component name (e.g. `cloud: {}`)',
  })
  @Transform(transformObject(DependencySpec))
  dependencies?: Dictionary<string | DependencySpec>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: AnyOf('string', ComponentInterfaceSpec),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A set of named gateways that broker access to the services inside the component. All network traffic within a component is locked down to the component itself, unless included in this interfaces block. An interface represents a front-door to your component, granting access to upstream callers.',
    deprecated: true,
  })
  @Transform(transformObject(ComponentInterfaceSpec))
  protected interfaces?: Dictionary<string | ComponentInterfaceSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    deprecated: true,
    description: '-',
  })
  artifact_image?: string;

  get deprecated_interfaces(): Dictionary<string | ComponentInterfaceSpec> {
    return this.interfaces || {};
  }

  get resources(): Dictionary<ResourceSpec> {
    return { ...this.services, ...this.tasks };
  }
}
