import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { AnyOf, DictionaryOfAny } from '../json-schema-annotations';
import { ResourceSpec } from './resource-spec';

export class ScalingMetricsSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  cpu?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  memory?: string;
}

export class ScalingSpec {
  @JSONSchema({ type: 'string' })
  min_replicas!: string;

  @JSONSchema({ type: 'string' })
  max_replicas!: string;

  // TODO:269:jsonschema (cpu || memory)
  @ValidateNested()
  metrics!: ScalingMetricsSpec;
}

export class InterfaceSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  host?: string;

  @JSONSchema({ type: 'string' })
  port!: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  protocol?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  username?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  password?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  url?: string;

  @IsOptional()
  @JSONSchema(AnyOf('boolean', 'string'))
  sticky?: boolean | string;
}

export class LivenessProbeSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  success_threshold?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  failure_threshold?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  timeout?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  interval?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  initial_delay?: string;

  // TODO:269:jsonschema: (path XOR command)
  // TODO:269:jsonschema: (!command || (path || port) && command)
  @Matches(/^\/.*$/, { message: 'Path should start with /. Ex. /health' }) // TODO:269: factor out into constant
  @JSONSchema({ type: 'string' })
  path?: string;

  // TODO:269:refactor: there are few instances of string[] | string, we should consider factoring out
  @JSONSchema({
    anyOf: [
      {
        type: "array",
        items: {
          type: 'string',
        },
      },
      {
        type: 'string',
      },
    ],
  })
  command?: string[] | string;

  @JSONSchema(AnyOf('number', 'string'))
  port!: number | string;
}

export class ServiceSpec extends ResourceSpec {
  @IsOptional()
  @ValidateNested()
  debug?: ServiceSpec;

  @IsOptional()
  @JSONSchema(DictionaryOfAny(InterfaceSpec, 'string'))
  interfaces?: Dictionary<InterfaceSpec | string>;

  @IsOptional()
  @ValidateNested()
  liveness_probe?: LivenessProbeSpec;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  replicas?: string;

  //TODO:269: JSONschema for interpolation
  // @IsOptional()/
  // @JSONSchema({ type: ['string', 'interpolation_ref'] })
  // replicas?: string | InterpolationString; // try making this generic on Config

  @IsOptional()
  @ValidateNested()
  scaling?: ScalingSpec;
}
