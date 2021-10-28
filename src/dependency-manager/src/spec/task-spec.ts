import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ResourceSpec } from './resource-spec';
import { ExpressionOrString } from './utils/json-schema-annotations';

@JSONSchema({
  description: 'A Task represents a recurring and/or exiting runtime (e.g. crons, schedulers, triggered jobs). Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image.',
})
export class TaskSpec extends ResourceSpec {
  @IsOptional()
  @ValidateNested()
  debug?: Partial<TaskSpec>;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString({
      format: 'cron',
      errorMessage: {
        format: "must be a valid cron expression",
      },
    }),
    description: 'A cron expression by which this task will be scheduled. Leave blank to deploy a task that never runs unless triggered from the CLI.',
  })
  schedule?: string;
}
