import { IsOptional } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ExclusiveOrNeither, ExpressionOr, ExpressionOrString, StringOrStringArray } from './utils/json-schema-annotations';

@JSONSchema({
  "allOf": [
    {
      "oneOf": [
        {
          "type": "object",
          "required": [
            "command",
          ],
        },
        {
          "type": "object",
          "required": [
            "path", "port",
          ],
        },
      ],
    },
    {
      "not":
      {
        "type": "object",
        "required": [
          "command", "port",
        ],
      },
    },
    {
      "not":
      {
        "type": "object",
        "required": [
          "command", "path",
        ],
      },
    },
  ],
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
  @JSONSchema({
    deprecated: true,
    ...ExpressionOr({ type: 'string', pattern: '^\\/.*$' }),
    description: '[Deprecated: use `command` instead.] Path for the http check executable. Path should be absolute (e.g. /health). If `path` is set, `port` also must be set. This field is disjunctive with `command` (only one of `path` or `command` can be set).',
  })
  path?: string;

  @IsOptional()
  @JSONSchema({
    ...StringOrStringArray(),
    description: 'Command that runs the http check. This field is disjunctive with `path` and `port` (only one of `command` or `path`/`port` can be set).',
  })
  command?: string | string[];

  @IsOptional()
  @JSONSchema({
    deprecated: true,
    ...ExpressionOr({ type: 'number' }),
    description: '[Deprecated: use `command` instead.] Port that the http check will run against. If `port` is set, `path` also must be set. This field is disjunctive with `command` (only one of `port` or `command` can be set).',
  })
  port?: number | string;
}

@JSONSchema({
  ...ExclusiveOrNeither("host_path", "key"),
  description: 'Architect can mount volumes onto your services and tasks to store data that should be shared between running containers or that should persist beyond the lifetime of a container.',
})
export class VolumeSpec {
  static readonly merge_key = 'mount_path';

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'Directory at which the volume will be mounted inside the container.',
  })
  mount_path?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'A directory on the host machine to sync with the mount_path on the docker image. This field is only relevant inside the debug block for local deployments. This field is disjunctive with `key` (only one of `host_path` or `key` can be set).',
  })
  host_path?: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString(),
    description: 'A reference to the underlying volume on the deployment platform of choice. The `docker-compose` volume name, the name of the Kubernetes PersistentVolumeClaim, or the EFS ID of an AWS volume. This field is disjunctive with `host_path` (only one of `key` or `host_path` can be set).',
    externalDocs: { url: 'https://docs.architect.io/components/services/#volumes' },
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
    ...ExpressionOr({ type: 'boolean' }),
    description: 'Marks the volume as readonly.',
    default: false,
  })
  readonly?: boolean | string;
}
