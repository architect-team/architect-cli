import { IsOptional } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ExpressionOr, ExpressionOrString, StringOrStringArray } from './utils/json-schema-annotations';

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
    ...ExpressionOr({ type: 'string', pattern: '^\\/.*$' }),
    description: 'Path for the http check executable. Path should be absolute (e.g. /health). If `path` is set, `port` also must be set. This field is disjunctive with `command` (only one of `path` or `command` can be set).',
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
    ...ExpressionOr({ type: 'number' }),
    description: 'Port that the http check will run against. If `port` is set, `path` also must be set. This field is disjunctive with `command` (only one of `port` or `command` can be set).',
  })
  port?: number | string;
}
