import { IsOptional, ValidateNested } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { WithRequired } from '../../common/utils/types';
import { ResourceSpec } from './resource-spec';
import { ExclusiveOrNeither, ExpressionOrString } from './utils/json-schema-annotations';
import { ResourceType } from './utils/slugs';

@JSONSchema({
  description: 'A Task represents a recurring and/or exiting runtime (e.g. crons, schedulers, triggered jobs). Each task will run on its specified schedule and/or be triggerable via the Architect CLI. Tasks are 1:1 with a docker image.',
  ...ExclusiveOrNeither('build', 'image'),
})
export class TaskSpec extends ResourceSpec {
  get resource_type(): ResourceType {
    return 'tasks';
  }

  @IsOptional()
  @ValidateNested()
  debug?: WithRequired<Partial<TaskSpec>, 'resource_type'>;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOrString({
      format: 'cron',
      errorMessage: {
        format: 'must be a valid cron expression',
      },
    }),
    description: 'A cron expression by which this task will be scheduled. Leave blank to deploy a task that never runs unless triggered from the CLI.',
  })
  schedule?: string;
}
