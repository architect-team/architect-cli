import { expect } from '@oclif/test';
import { ServiceConfigBuilder } from '../../src/dependency-manager/src';

describe('service config merge', function () {
  it('merge configs', function () {
    const service_config_json = {
      'name': 'foo/service',
      'description': 'a test service',
      'dependencies': {
        'no_override': 'old',
        'override': 'old'
      },
      'parameters': {
        'simple': { 'default': 'old' },
        'override': { 'default': 'old' },
        'valueFrom': { 'default': { 'valueFrom': { 'dependency': 'override', 'value': 'old' } } },
        'overrideValueFrom': { 'default': { 'valueFrom': { 'dependency': 'override', 'value': 'old' } } },
        'overrideValueFrom2': { 'default': { 'valueFrom': { 'dependency': 'override', 'value': 'old' } } },
      },
      'datastores': {
        'primary': {
          'image': 'postgres:10',
          'port': 5432,
          'parameters': {
            'POSTGRES_USER': {
              'default': 'postgres'
            },
            'POSTGRES_PASS': {
              'default': 'architect'
            },
            'POSTGRES_DB': {
              'default': 'addition_service'
            }
          }
        },
        'override': {
          'image': 'postgres:10',
          'port': 5432,
          'parameters': {
            'POSTGRES_USER': {
              'default': 'postgres'
            },
            'POSTGRES_PASS': {
              'default': 'architect'
            },
            'POSTGRES_DB': {
              'default': 'addition_service'
            }
          }
        },
      },
      'volumes': {
        'simple': {
          'mountPath': '/simple'
        },
        'db_data': {
          'mountPath': '/db'
        }
      },
      'api': {
        'type': 'grpc',
        'definitions': []
      },
      'subscriptions': {},
      'keywords': [],
      'debug': './test.ts'
    };

    const env_config_json = {
      'dependencies': {
        'override': 'new'
      },
      'parameters': {
        'override': 'new',
        'overrideValueFrom': 'new',
        'overrideValueFrom2': { 'default': { 'valueFrom': { 'dependency': 'override', 'value': 'override' } } },
      },
      'datastores': {
        'override': {
          'host': 'override',
          'parameters': {
            'POSTGRES_USER': 'override'
          }
        },
        'new': {
          'image': 'postgres:10',
          'port': 5432,
          'parameters': {
            'POSTGRES_USER': {
              'default': 'postgres'
            },
            'POSTGRES_PASS': {
              'default': 'architect'
            },
            'POSTGRES_DB': {
              'default': 'addition_service'
            }
          }
        }
      },
      'volumes': {
        'db_data': './db',
        'new_db_data': {
          'mountPath': '/new_db',
          'hostPath': './new_db'
        }
      }
    };

    const service_config = ServiceConfigBuilder.buildFromJSON(service_config_json);
    const env_config = ServiceConfigBuilder.buildFromJSON(env_config_json);

    const node_config = service_config.merge(env_config);

    expect(node_config.getName()).eq('foo/service');

    expect(node_config.getDependencies()).keys('override', 'no_override');
    expect(node_config.getDependencies()['override']).eq('new');
    expect(node_config.getDependencies()['no_override']).eq('old');

    expect(node_config.getParameters()).keys('override', 'simple', 'overrideValueFrom', 'overrideValueFrom2', 'valueFrom');
    expect(node_config.getParameters()['override'].default).eq('new');
    expect(node_config.getParameters()['overrideValueFrom'].default).eq('new');
    expect(node_config.getParameters()['overrideValueFrom2'].default!.toString()).eq({ 'default': { 'valueFrom': { 'dependency': 'override', 'value': 'override' } } }.toString());
    expect(node_config.getParameters()['simple'].default).eq('old');
    expect(node_config.getParameters()['valueFrom'].default!.toString()).eq({ 'valueFrom': { 'dependency': 'override', 'value': 'old' } }.toString());

    expect(node_config.getDatastores()).keys('primary', 'override', 'new');
    expect(node_config.getDatastores()['override'].host).eq('override');
    expect(node_config.getDatastores()['override'].image).eq('postgres:10');
    expect(node_config.getDatastores()['override'].parameters).keys('POSTGRES_USER', 'POSTGRES_PASS', 'POSTGRES_DB');
    expect(node_config.getDatastores()['override'].parameters.POSTGRES_USER.default).eq('override');

    expect(node_config.getDebugOptions()!.command).eq('./test.ts');

    expect(node_config.getVolumes()).keys('simple', 'db_data', 'new_db_data')
    expect(node_config.getVolumes().db_data.mountPath).eq('/db')
    expect(node_config.getVolumes().db_data.hostPath).eq('./db')
    expect(node_config.getVolumes().new_db_data.mountPath).eq('/new_db')
    expect(node_config.getVolumes().new_db_data.hostPath).eq('./new_db')
  });
});
