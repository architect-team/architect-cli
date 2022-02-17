import { Transform } from 'class-transformer';
import { Allow, IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { LivenessProbeSpec, VolumeSpec } from './common-spec';
import { ResourceSpec } from './resource-spec';
import { SidecarSpec } from './sidecar-spec';
import { transformObject } from './transform/common-transform';
import { AnyOf, ExclusiveOr, ExpressionOr, ExpressionOrString, RequiredOr } from './utils/json-schema-annotations';
import { Slugs } from './utils/slugs';

@JSONSchema({
  ...RequiredOr('cpu', 'memory'),
  description: 'Scaling metrics define the upper bound of resource consumption before spinning up an additional replica.',
})
export class ScalingMetricsSpec {
  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'The cpu usage required to trigger scaling. This field is disjunctive with `memory` (only one of `cpu` or `memory` can be set).',
    externalDocs: { url: '/docs/configuration/services#cpu--memory' },
  })
  cpu?: number | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The memory usage required to trigger scaling. This field is disjunctive with `cpu` (only one of `memory` or `cpu` can be set).',
    externalDocs: { url: '/docs/configuration/services#cpu--memory' },
  })
  memory?: string;
}

@JSONSchema({
  description: 'Configuration that dictates the scaling behavior of a service.',
})
export class ScalingSpec {
  @Allow()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'The target minimum number of service replicas.',
  })
  min_replicas!: number | string;

  @Allow()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'The target maximum number of service replicas.',
  })
  max_replicas!: number | string;

  @ValidateNested()
  metrics!: ScalingMetricsSpec;
}

@JSONSchema({
  ...ExclusiveOr('port', 'url'),
  description: 'A service interface exposes service functionality over the network to other services within the same component. If you would like to expose services on the network to external components, see the ComponentInterfaceSpec',
})
export class ServiceInterfaceSpec {
  static readonly merge_key = 'port';

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'A human-readable description of the interface.',
  })
  description?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(AnyOf('null', 'string')),
    description: 'The host address of an existing service to use instead of provisioning a new one. Setting this field effectively overrides any deployment of this service and directs all traffic to the given host.',
  })
  host?: null | string;

  @Allow()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'Port on which the service is listening for traffic.',
  })
  port!: number | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Protocol that the interface responds to',
    default: 'http',
  })
  protocol?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(AnyOf('null', 'string')),
    description: 'A Basic Auth username required to access the interface',
  })
  username?: null | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(AnyOf('null', 'string')),
    description: 'A Basic Auth password required to access the interface',
  })
  password?: null | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'string', pattern: '^\\/.*$' }),
    description: 'The path of the interface',
  })
  path?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The url of an existing service to use instead of provisioning a new one. Setting this field effectively overrides any deployment of this service and directs all traffic to the given url.',
  })
  url?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(AnyOf('boolean')),
    description: 'Denotes that if this interface is made external, the gateway should use sticky sessions',
    default: false,
  })
  sticky?: boolean | string;
}

@JSONSchema({
  description: 'A runtimes (e.g. daemons, servers, etc.). Each service is independently deployable and scalable. Services are 1:1 with a docker image.',
})
export class ServiceSpec extends ResourceSpec {
  @IsOptional()
  @ValidateNested()
  debug?: Partial<ServiceSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: ExpressionOr(AnyOf(ServiceInterfaceSpec, 'number')),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A set of named interfaces to expose service functionality over the network to other services within the same component. A `string` or `number` represents the TCP port that the service is listening on. For more detailed configuration, specify a full `ServiceInterfaceSpec` object.',
  })
  @Transform(transformObject(ServiceInterfaceSpec))
  interfaces?: Dictionary<ServiceInterfaceSpec | string | number>;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: AnyOf(SidecarSpec),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A set of services to run as a sidecar for this service.',
  })
  @Transform(transformObject(SidecarSpec))
  sidecars?: Dictionary<SidecarSpec>;

  @IsOptional()
  @ValidateNested()
  liveness_probe?: LivenessProbeSpec;

  @IsOptional()
  @JSONSchema({
    type: 'object',
    patternProperties: {
      [Slugs.ArchitectSlugValidator.source]: AnyOf(VolumeSpec, 'string'),
    },
    errorMessage: {
      additionalProperties: Slugs.ArchitectSlugDescription,
    },
    description: 'A set of named volumes to be mounted at deploy-time. Take advantage of volumes to store data that should be shared between running containers or that should persist beyond the lifetime of a container.',
  })
  @Transform(transformObject(VolumeSpec))
  volumes?: Dictionary<VolumeSpec | string>;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'A static number of replicas of a service to be deployed. For scaling configuration, see `scaling` field.',
  })
  replicas?: number | string;

  @IsOptional()
  @ValidateNested()
  @Transform(transformObject(ScalingSpec))
  scaling?: ScalingSpec;
}
