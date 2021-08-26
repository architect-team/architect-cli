import { Allow, IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../utils/dictionary';
import { ResourceSpec } from './resource-spec';
import { AnyOf, DictionaryOfAny, ExclusiveOr, ExpressionOr, ExpressionOrString, StringOrStringArray } from './utils/json-schema-annotations';

@JSONSchema({
  ...ExclusiveOr('cpu', 'memory'),
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
  ...ExclusiveOr("command", "path"),
  description: 'Configuration for service health checks. Architect uses health checks are used for load balancing and rolling updates.',
})
export class LivenessProbeSpec {
  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'The number of times to retry a health check before the container is considered healthy.',
    default: LivenessProbeSpec.default_success_threshold,
  })
  success_threshold?: number | string;
  public static default_success_threshold = 1;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'The number of times to retry a failed health check before the container is considered unhealthy.',
    default: LivenessProbeSpec.default_failure_threshold,
  })
  failure_threshold?: number | string;
  public static default_failure_threshold = 3;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The time period to wait for a health check to succeed before it is considered a failure. You may specify any value between: 2s and 60s',
    default: LivenessProbeSpec.default_timeout,
  })
  timeout?: string;
  public static default_timeout = '5s';

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'The time period in seconds between each health check execution. You may specify any value between: 5s and 300s',
    default: LivenessProbeSpec.default_interval,
  })
  interval?: string;
  public static default_interval = '30s';

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Delays the check from running for the specified amount of time',
    default: LivenessProbeSpec.default_initial_delay,
  })
  initial_delay?: string;
  public static default_initial_delay = '0s';

  @IsOptional()
  @Matches(/^\/.*$/)
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Path for the http check executable. Path should be absolute (e.g. /health). This field is disjunctive with `command` (only `path` or `command` can be set).',
  })
  path?: string;

  @IsOptional()
  @JSONSchema({
    ...StringOrStringArray(),
    description: 'Command that runs the http check. This field is disjunctive with `path` (only `command` or `path` can be set).',
  })
  command?: string | string[];

  @Allow()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'Port that the http check will run against',
  })
  port!: number | string;
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
    ...DictionaryOfAny(ServiceInterfaceSpec, 'string', 'number'),
    description: 'A set of named interfaces to expose service functionality over the network to other services within the same component. A `string` or `number` represents the TCP port that the service is listening on. For more detailed configuration, specify a full `ServiceInterfaceSpec` object.',
  })
  interfaces?: Dictionary<ServiceInterfaceSpec | string | number>;

  @IsOptional()
  @ValidateNested()
  liveness_probe?: LivenessProbeSpec;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ type: 'number' }),
    description: 'A static number of replicas of a service to be deployed. For scaling configuration, see `scaling` field.',
  })
  replicas?: number | string;

  //TODO:290: JSONschema for interpolation
  // @IsOptional()/
  // @JSONSchema({ type: ['string', 'interpolation_ref'] })
  // replicas?: string | InterpolationString; // consider making this generic on Config

  @IsOptional()
  @ValidateNested()
  scaling?: ScalingSpec;
}
