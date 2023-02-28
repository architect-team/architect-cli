import { coerce } from 'semver';
import { DatabaseConfig, ServiceConfig } from '../../config/service-config';
import { ArchitectError } from '../../utils/errors';
import { ComponentInstanceMetadata } from '../component-spec';
import { DatabaseSpec } from '../database-spec';
import { SupportedDatabases } from '../static/database-static';
import { Slugs } from '../utils/slugs';
import { transformServiceSpec } from './service-transform';

export const transformDatabaseSpecToServiceSpec = (key: string, db_spec: DatabaseSpec, metadata: ComponentInstanceMetadata): ServiceConfig => {
  const [engine, version] = db_spec.type.split(':');

  const semver_version = coerce(version);
  if (!semver_version) {
    throw new ArchitectError(`Unable to parse out database version for requested image: ${key}`);
  }

  const match = SupportedDatabases.find(match =>
    match.engine === engine &&
    semver_version?.major >= (match.versions.min || 0) &&
    semver_version?.major <= (match.versions.max || 1000));

  if (!match) {
    throw new Error(`Unsupported database engine: ${engine}`);
  }

  const service_spec = match.spec;
  service_spec.image = db_spec.type;
  return transformServiceSpec(`${key}${Slugs.DB_SUFFIX}`, service_spec, metadata);
};

export const transformDatabaseSpec = (key: string, db_spec: DatabaseSpec, metadata: ComponentInstanceMetadata): DatabaseConfig => {
  return {
    ...db_spec,
    url: db_spec.connection_string,
  };
};
