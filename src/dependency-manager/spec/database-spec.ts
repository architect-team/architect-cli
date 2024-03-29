import { IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { SUPPORTED_DATABASE_TYPES } from './static/database-static';
import { ExpressionOr } from './utils/json-schema-annotations';
import { Slugs } from './utils/slugs';

@JSONSchema({
  description: 'Component databases let you quickly spin up a database for your service',
})
export class DatabaseSpec {
  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'Human readable description',
  })
  description?: string;

  @IsString()
  @JSONSchema({
    ...ExpressionOr({ type: 'string', enum: SUPPORTED_DATABASE_TYPES }),
    description: 'The type engine and version of database software needed for data storage.',
    errorMessage: Slugs.ComponentDatabaseDescription,
  })
  type!: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr({ format: 'uri', type: 'string' }, { type: 'null' }),
    description: 'The connection uri of an existing database to use instead of provisioning a new one',
  })
  connection_string?: string;
}
