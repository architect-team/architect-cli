import { IsOptional, Matches, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { Dictionary } from '../../utils/dictionary';
import { AnyOf, DictionaryOfAny } from '../json-schema-annotations';
import { ResourceSpecV1 } from './resource-spec-v1';

export class ScalingMetricsSpecV1 {
  @IsOptional()
  @JSONSchema({ type: 'string' })
  cpu?: string;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  memory?: string;
}

export class ScalingSpecV1 {
  @JSONSchema({ type: 'string' })
  min_replicas!: string;

  @JSONSchema({ type: 'string' })
  max_replicas!: string;

  // TODO:269:next "at least one"
  // @AtLeastOne(['cpu', 'memory'], { always: true, message: `Either a cpu metric, a memory metric, or both must be defined.` })
  @ValidateNested()
  metrics!: ScalingMetricsSpecV1;

  // TODO:269:validate
  // async validate(options?: ValidatorOptions) {
  //   if (!options) { options = {}; }
  //   let errors = await super.validate(options);
  //   if (errors.length) return errors;
  //   errors = await validateNested(this, 'metrics', errors, options);
  //   return errors;
  // }
}

export class InterfaceSpecV1 {
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

export class LivenessProbeSpecV1 {
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

  // TODO:269:next: exclusive OR across properties
  // @Exclusive(['command'], { always: true, message: 'Path with port and command are exclusive' })
  // @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command),)
  @Matches(/^\/.*$/, { message: 'Path should start with /. Ex. /health' }) // TODO:269: factor out into constant
  @JSONSchema({ type: 'string' })
  path?: string;

  // TODO:269:next: exclusive OR across properties
  // @Exclusive(['path', 'port'], { always: true, message: 'Command and path with port are exclusive' })
  // @ValidateIf(obj => !obj.path || ((obj.path || obj.port) && obj.command),)
  @JSONSchema({ // TODO:269: there are few instances of string[] | string, we should consider factoring out
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

  // TODO:269:next: exclusive OR across properties
  // @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command),)
  // @Exclusive(['command'], { always: true, message: 'Command and path with port are exclusive' })
  @JSONSchema(AnyOf('number', 'string'))
  port!: number | string;
}

export class ServiceSpecV1 extends ResourceSpecV1 {
  // TODO:269:validation
  // @IsEmpty({ groups: ['debug'] })
  @IsOptional()
  @ValidateNested()
  debug?: ServiceSpecV1;

  @IsOptional()
  @JSONSchema(DictionaryOfAny(InterfaceSpecV1, 'string'))
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  @IsOptional()
  @ValidateNested()
  liveness_probe?: LivenessProbeSpecV1;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  replicas?: string;

  @IsOptional()
  @ValidateNested()
  scaling?: ScalingSpecV1;

  // TODO:269:validation
  // async validate(options?: ValidatorOptions) {
  //   if (!options) { options = {}; }
  //   let errors = await super.validate(options);
  //   if (errors.length) return errors;
  //   const expanded = this.expand();
  //   errors = await validateNested(expanded, 'liveness_probe', errors, options);
  //   errors = await validateNested(expanded, 'scaling', errors, options);
  //   errors = await validateNested(expanded, 'build', errors, options);
  //   return errors;
  // }

  // /** @return New expanded copy of the current config */
  // expand() {
  //   const config = super.expand();
  //   for (const [key, value] of Object.entries(this.getInterfaces())) {
  //     config.setInterface(key, value);
  //   }
  //   return config;
  // }
}
