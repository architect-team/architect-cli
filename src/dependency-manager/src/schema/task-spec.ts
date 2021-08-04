import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ResourceSpec } from './resource-spec';

export class TaskSpec extends ResourceSpec {

  // TODO:269:validation
  // @IsEmpty({ groups: ['debug'] })
  @IsOptional()
  @ValidateNested()
  debug?: TaskSpec;

  @IsOptional()
  @JSONSchema({ type: 'string' })
  schedule?: string;

  // TODO:269:validation
  // async validate(options?: ValidatorOptions) {
  //   if (!options) { options = {}; }
  //   let errors = await super.validate(options);
  //   if (errors.length) return errors;
  //   const expanded = this.expand();
  //   errors = await validateNested(expanded, 'debug', errors, { ...options, groups: (options.groups || []).concat('debug') });
  //   // Hack to overcome conflicting IsEmpty vs IsNotEmpty with developer vs debug
  //   const volumes_options = { ...options };
  //   if (volumes_options.groups && volumes_options.groups.includes('debug')) {
  //     volumes_options.groups = ['debug'];
  //   }
  //   errors = await validateDictionary(expanded, 'environment', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
  //   errors = await validateDictionary(expanded, 'volumes', errors, undefined, volumes_options);
  //   return errors;
  // }
}
