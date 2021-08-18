import { Allow, IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { AnyOf, DictionaryOfAny, StringOrStringArray } from '../json-schema-annotations';
import { ResourceSpec } from './resource-spec';

export class ScalingMetricsSpec {
  @IsOptional()
  @JSONSchema(AnyOf('number', 'string'))
  cpu?: number | string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  memory?: string;
}

export class ScalingSpec {
  @Allow()
  @JSONSchema(AnyOf('number', 'string'))
  min_replicas!: number | string;

  @Allow()
  @JSONSchema(AnyOf('number', 'string'))
  max_replicas!: number | string;

  // TODO:289: (cpu || memory)
  @ValidateNested()
  metrics!: ScalingMetricsSpec;
}

export class ServiceInterfaceSpec {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  description?: string;

  @IsOptional()
  @JSONSchema(AnyOf('null', 'string'))
  host?: null | string;

  // TODO:289: port XOR url
  @Allow()
  @JSONSchema(AnyOf('number', 'string'))
  port!: number | string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  protocol?: string;

  @IsOptional()
  @JSONSchema(AnyOf('null', 'string'))
  username?: null | string;

  @IsOptional()
  @JSONSchema(AnyOf('null', 'string'))
  password?: null | string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  url?: string;

  @IsOptional()
  @JSONSchema(AnyOf('boolean', 'string'))
  sticky?: boolean | string;
}

export class LivenessProbeSpec {
  @IsOptional()
  @JSONSchema(AnyOf('number', 'string'))
  success_threshold?: number | string;

  @IsOptional()
  @JSONSchema(AnyOf('number', 'string'))
  failure_threshold?: number | string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  timeout?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  interval?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  initial_delay?: string;

  // TODO:289: (path XOR command)
  // TODO:289: (!command || (path || port) && command)
  @Matches(/^\/.*$/, { message: 'Path should start with /. Ex. /health' }) // TODO:289:factor out into constant
  @JSONSchema({ type: 'string' })
  path?: string;

  @JSONSchema(StringOrStringArray())
  command?: string | string[];

  @Allow()
  @JSONSchema(AnyOf('number', 'string'))
  port!: number | string;
}

export class ServiceSpec extends ResourceSpec {
  @IsOptional()
  @ValidateNested()
  debug?: ServiceSpec;

  @IsOptional()
  @JSONSchema(DictionaryOfAny(ServiceInterfaceSpec, 'string', 'number'))
  interfaces?: Dictionary<ServiceInterfaceSpec | string | number>;

  @IsOptional()
  @ValidateNested()
  liveness_probe?: LivenessProbeSpec;

  @IsOptional()
  @JSONSchema(AnyOf('number', 'string'))
  replicas?: number | string;

  //TODO:290: JSONschema for interpolation
  // @IsOptional()/
  // @JSONSchema({ type: ['string', 'interpolation_ref'] })
  // replicas?: string | InterpolationString; // consider making this generic on Config

  @IsOptional()
  @ValidateNested()
  scaling?: ScalingSpec;
}
