import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ResourceSpec } from './resource-spec';

@JSONSchema({
  description: 'A Task represents a recurring and/or exiting runtime (e.g. crons, schedulers, triggered jobs). Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image.',
})
export class TaskSpec extends ResourceSpec {
  @IsOptional()
  @ValidateNested()
  @JSONSchema({
    description: 'A partial object that is deep-merged into the spec on local deployments. Useful to mount developer volumes or set other local-development configuration. Think of this as a "local override" block.',
  })
  debug?: Partial<TaskSpec>;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'A cron expression by which this task will be scheduled. Leave blank to deploy a task that never runs unless triggered from the CLI.',
  })
  schedule?: string;
}
