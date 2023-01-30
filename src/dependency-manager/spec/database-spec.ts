import { IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { AnyOf, ExpressionOr } from './utils/json-schema-annotations';
import { Slugs } from './utils/slugs';

export class DatabaseSpec {
  @IsOptional()
  @JSONSchema({
    type: 'string',
    pattern: Slugs.ArchitectSlugValidator.source,
    errorMessage: Slugs.ArchitectSlugDescription,
    description: 'A specific service name which will override the database name specified in the component.',
  })
  reserved_name?: string;

  @IsOptional()
  @JSONSchema({
    type: 'string',
    description: 'Human readable description',
  })
  description?: string;

  @IsString()
  @JSONSchema({
    ...ExpressionOr({ type: 'string', pattern: Slugs.ComponentDatabaseValidator.source }),
    description: 'The type engine and version of database software needed for data storage.',
    errorMessage: Slugs.ComponentDatabaseDescription,
  })
  type!: string;

  @IsOptional()
  @JSONSchema({
    ...ExpressionOr(AnyOf('null', 'string')),
    description: 'The connection string of an existing database to use instead of provisioning a new one',
  })
  connection_string?: null | string;
}
