import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { AnyOf, ArrayOf, DictionaryOf, DictionaryOfAny, ExclusiveOrNeither, OneOf, StringOrStringArray } from '../utils/json-schema-annotations';
import { Slugs } from '../utils/slugs';

@JSONSchema({
  description: 'The DeploySpec represents deploy-time configuration for a service or a task.',
})
export class DeployModuleSpec {
  @IsString()
  @JSONSchema({
    type: 'string',
    description: 'The path to a Terraform module relative to the `architect.yml` file. Loaded at component registeration time.',
  })
  path!: string;

  @IsObject()
  @JSONSchema({
    ...DictionaryOfAny('string', 'null'),
    description: 'A set of key-value pairs that represent Terraform inputs and their values.',
  })
  inputs!: Dictionary<string | null>;
}

@JSONSchema({
  description: 'The DeploySpec represents deploy-time configuration for a service or a task.',
})
export class DeploySpec {
  @IsString()
  @JSONSchema({
    type: 'string',
    description: 'Selects the preferred deploy strategy for the service.',
  })
  strategy!: string;

  @IsObject()
  @JSONSchema({
    ...DictionaryOf(DeployModuleSpec),
    description: 'A set of named Terraform modules to override the default Terraform that architect uses at deploy-time.',
  })
  modules!: Dictionary<DeployModuleSpec>;
}

@JSONSchema({
  ...ExclusiveOrNeither("host_path", "key"),
  description: 'Architect can mount volumes onto your services and tasks to store data that should be shared between running containers or that should persist beyond the lifetime of a container.',
})
export class VolumeSpec {
  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'Directory at which the volume will be mounted inside the container.',
  })
  mount_path?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A directory on the host machine to sync with the mount_path on the docker image. This field is only relevant inside the debug block for local deployments. This field is disjunctive with `key` (only one of `host_path` or `key` can be set).',
  })
  host_path?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A reference to the underlying volume on the deployment platform of choice. The `docker-compose` volume name, the name of the Kubernetes PersistentVolumeClaim, or the EFS ID of an AWS volume. This field is disjunctive with `host_path` (only one of `key` or `host_path` can be set).',
    externalDocs: { url: '/docs/configuration/services#volumes' },
  })
  key?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'Human-readable description of volume',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    ...AnyOf('boolean', 'string'),
    description: 'Marks the volume as readonly.',
    default: false,
  })
  readonly?: boolean | string;
}

export type EnvironmentSpecValue = boolean | null | number | object | string;
export const EnvironmentSpecSchema = DictionaryOfAny('array', 'boolean', 'null', 'number', 'object', 'string');

@JSONSchema({
  description: 'An object containing the details necessary for Architect to build the service via Docker. Whenever a service that specifies a build field is registered with Architect, the CLI will trigger a docker build and replace the build field with a resolvable image.',
})
export class BuildSpec {
  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The path to the directory containing the source code relative to the `architect.yml` file.',
  })
  context?: string;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOfAny('string', 'null'),
    description: 'Build args to be passed into `docker build`.',
  })
  args?: Dictionary<string | null>;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The path to the Dockerfile relative to the `build.context`',
    default: 'Dockerfile',
  })
  dockerfile?: string;
}

@JSONSchema({
  ...OneOf("build", "image"),
})
export abstract class ResourceSpec {
  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'Human readable description',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The docker image that serves as the unit of runtime. This field is disjunctive with `build` (only one of `image` or `build` can be set)',
  })
  image?: string;

  @IsOptional()
  @JSONSchema({
    ...StringOrStringArray(),
    description: 'The docker startup command. Use this if you need to override or parameterize or parameterize the docker image command.',
  })
  command?: string | string[];

  @IsOptional()
  @JSONSchema({
    ...StringOrStringArray(),
    description: 'The docker entrypoint for the container. Use this if you need to override or parameterize the docker image entrypoint.',
  })
  entrypoint?: string | string[];

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The dominant programming language used; this is for informational purposes only.',
  })
  language?: string;

  @IsOptional()
  @ValidateNested()
  debug?: Partial<ResourceSpec>;

  @IsOptional()
  @JSONSchema({
    ...EnvironmentSpecSchema,
    description: 'A set of key-value pairs that describes environment variables and their values. Often, these are set to ${{ parameters.* }} or an architect-injected reference so they vary across environments.',
    externalDocs: { url: '/docs/configuration/services#local-configuration' },
  })
  environment?: Dictionary<EnvironmentSpecValue>;

  @IsOptional()
  @JSONSchema({
    ...DictionaryOfAny(VolumeSpec, 'string'),
    description: 'A set of named volumes to be mounted at deploy-time. Take advantage of volumes to store data that should be shared between running containers or that should persist beyond the lifetime of a container.',
  })
  volumes?: Dictionary<VolumeSpec | string>;

  @IsOptional()
  @ValidateNested()
  build?: BuildSpec;

  @IsOptional()
  @JSONSchema({
    ...AnyOf('number', 'string'),
    description: 'The cpu required to run a service or a task',
    externalDocs: { url: '/docs/configuration/services#cpu--memory' },
  })
  cpu?: number | string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'The memory required to run a service or a task.',
    externalDocs: { url: '/docs/configuration/services#cpu--memory' },
  })
  memory?: string;

  @IsOptional()
  @ValidateNested()
  deploy?: DeploySpec;

  @IsOptional()
  @JSONSchema({
    ...ArrayOf('string'),
    description: 'An array of service names for those services in the component that are pre-requisites to deploy. Used at deploy-time to build a deploy order across services and tasks.',
  })
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
    description: 'A simple key-value annotation store; useful to organize, categorize, scope, and select services and tasks.',
    externalDocs: { url: '/docs/configuration/services#labels' },
  })
  labels?: Map<string, string>;
}
