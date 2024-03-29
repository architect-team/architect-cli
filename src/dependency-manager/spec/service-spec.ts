import { V1Deployment } from '@kubernetes/client-node';
import { Transform, Type } from 'class-transformer';
import { Allow, IsOptional, IsString, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { DeepPartial, WithRequired } from '../../common/utils/types';
import { Dictionary } from '../utils/dictionary';
import { LivenessProbeSpec, VolumeSpec } from './common-spec';
import { ResourceSpec } from './resource-spec';
import { transformObject } from './transform/common-transform';
import { AnyOf, ExclusiveOr, ExclusiveOrNeither, ExpressionOr, ExpressionOrString, RequiredOr } from './utils/json-schema-annotations';
import { ResourceType, Slugs } from './utils/slugs';
import { EXPRESSION_REGEX } from './utils/interpolation';

@JSONSchema({
  description: 'Configuration for custom certificate.',
})
export class IngressTlsSpec {
  @IsString()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Custom certificate.',
  })
  crt!: string;

  @IsString()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Custom certificate key.',
  })
  key!: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Custom certificate ca.',
  })
  ca?: string;
}

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
    ...ExpressionOr({ type: 'string', pattern: Slugs.ComponentSubdomainValidator.source }),
    description: 'The subdomain that will be used if the interface is exposed externally. Use `subdomain: @` to target the base domain.',
    errorMessage: Slugs.ComponentSubdomainDescription,
  })
  subdomain?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IngressTlsSpec)
  tls?: IngressTlsSpec;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'string', pattern: '^\\/.*$' }),
    description: 'The path of the interface used for path based routing',
  })
  path?: string;

  @IsOptional()
  @JSONSchema({
    anyOf: [{
      type: 'array',
      items: {
        anyOf: [{ type: 'string', format: 'cidrv4' }, { type: 'string', pattern: '\\${{\\s*secrets\\.[\\w-]+\\s*}}' }],
      },
    }, {
      type: 'string',
      pattern: `${EXPRESSION_REGEX.source}|${/(?:\d{1,3}\.){3}\d{1,3}(?:\/\d\d?)?,?/g.source}`,
      errorMessage: {
        // __arc__ is replaced later to avoid json pointer issues with ajv
        pattern: 'must be an interpolation ref ex. $__arc__{{ secrets.example }}, or a comma-delimited list of cidr/ip addresses ex 8.8.8.8,8.8.4.4/24',
      },
    }],
    description: 'IP addresses that are allowed to access the interface',
  })
  ip_whitelist?: string | string[];

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'boolean' }),
    description: 'Marks the ingress as private behind Architect authentication',
  })
  private?: boolean | string;
}

@JSONSchema({
  ...RequiredOr('cpu', 'memory'),
  description: 'Scaling metrics define the upper bound of resource consumption before spinning up an additional replica.',
})
export class ScalingMetricsSpec {
  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'integer', minimum: 0, maximum: 100 }),
    description: 'The cpu usage required to trigger scaling.',
    externalDocs: { url: 'https://docs.architect.io/components/services/#cpu--memory' },
  })
  cpu?: number | string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'integer', minimum: 0, maximum: 100 }),
    description: 'The memory usage required to trigger scaling.',
    externalDocs: { url: 'https://docs.architect.io/components/services/#cpu--memory' },
  })
  memory?: number | string;
}

@JSONSchema({
  description: 'Configuration that dictates the scaling behavior of a service.',
})
export class ScalingSpec {
  @Allow()
  @JSONSchema({
    ...ExpressionOr({ type: 'integer', minimum: 0 }),
    description: 'The target minimum number of service replicas.',
  })
  min_replicas!: number | string;

  @Allow()
  @JSONSchema({
    ...ExpressionOr({ type: 'integer', minimum: 0 }),
    description: 'The target maximum number of service replicas.',
  })
  max_replicas!: number | string;

  @ValidateNested()
  metrics!: ScalingMetricsSpec;
}

@JSONSchema({
  description: 'Configuration that dictates the kubernetes deploy overrides.',
})
export class KubernetesDeploySpec {
  @Allow()
  deployment!: DeepPartial<V1Deployment>;
}

@JSONSchema({
  description: 'Configuration that dictates the deploy overrides.',
})
export class DeploySpec {
  @Allow()
  @ValidateNested()
  @Type(() => KubernetesDeploySpec)
  kubernetes!: KubernetesDeploySpec;
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

  @IsOptional()
  @ValidateNested()
  ingress?: IngressSpec;
}

@JSONSchema({
  description: 'A runtimes (e.g. daemons, servers, etc.). Each service is independently deployable and scalable. Services are 1:1 with a docker image.',
  ...ExclusiveOrNeither('build', 'image'),
})
export class ServiceSpec extends ResourceSpec {
  get resource_type(): ResourceType {
    return 'services';
  }

  @IsOptional()
  @JSONSchema({
    type: 'boolean',
    description: 'Determines if the service should be running.',
    default: true,
  })
  enabled?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServiceSpec)
  debug?: WithRequired<Partial<ServiceSpec>, 'resource_type'>;

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
    ...ExpressionOr({ type: 'integer', minimum: 0 }),
    description: 'A static number of replicas of a service to be deployed. For scaling configuration, see `scaling` field.',
  })
  replicas?: number | string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ScalingSpec)
  scaling?: ScalingSpec;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeploySpec)
  deploy?: DeploySpec;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    default: '30s',
    description: `A period of time between a service being passed a SIGINT and a SIGTERM when it's scheduled to be replaced or terminated. Only used for remote deployments.`,
  })
  termination_grace_period?: string;
}
