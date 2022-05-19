import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { AnyOf, ArrayOf, ExpressionOr, ExpressionOrString, OneOf, StringOrStringArray } from './utils/json-schema-annotations';
import { Slugs } from './utils/slugs';

// eslint-disable-next-line @typescript-eslint/ban-types
export type EnvironmentSpecValue = boolean | null | number | object | string;

@JSONSchema({
  description: 'An object containing the details necessary for Architect to build the service via Docker. Whenever a service that specifies a build field is registered with Architect, the CLI will trigger a docker build and replace the build field with a resolvable image.',
})
export class BuildSpec {
  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The path to the directory containing the source code relative to the `architect.yml` file.',
  })
  context?: string;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      '^[a-zA-Z0-9_]+$': AnyOf('string', 'null'),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'Build args to be passed into `docker build`.',
  })
  args?: Dictionary<string | null>;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The path to the Dockerfile relative to the `build.context`',
    default: 'Dockerfile',
  })
  dockerfile?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The stage to build in the Dockerfile',
  })
  target?: string;
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
    ...ExpressionOrString(),
    description: 'The docker image that serves as the unit of runtime. This field is disjunctive with `build` (only one of `image` or `build` can be set)',
  })
  image?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(StringOrStringArray()),
    description: 'The docker startup command. Use this if you need to override or parameterize or parameterize the docker image command.',
  })
  command?: string | string[];

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(StringOrStringArray()),
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
  @JSONSchema({
    type: 'object',
    patternProperties: {
      '^[a-zA-Z0-9_]+$': AnyOf('array', 'boolean', 'null', 'number', 'object', 'string'),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A set of key-value pairs that describes environment variables and their values. Often, these are set to ${{ secrets.* }} or an architect-injected reference so they vary across environments.',
    externalDocs: { url: '/docs/components/services/#local-configuration' },
  })
  environment?: Dictionary<EnvironmentSpecValue>;

  @IsOptional()
  @ValidateNested()
  build?: BuildSpec;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'The cpu required to run a service or a task',
    externalDocs: { url: '/docs/components/services/#cpu--memory' },
  })
  cpu?: number | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The memory required to run a service or a task.',
    externalDocs: { url: '/docs/components/services/#cpu--memory' },
  })
  memory?: string;

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
      [Slugs.LabelKeySlugValidatorString]: ExpressionOr({
        type: "string",
        pattern: Slugs.LabelValueSlugValidatorString,
      }),
    },
    description: 'A simple key-value annotation store; useful to organize, categorize, scope, and select services and tasks.',
    externalDocs: { url: '/docs/components/services/#labels' },
  })
  labels?: Map<string, string>;
}
