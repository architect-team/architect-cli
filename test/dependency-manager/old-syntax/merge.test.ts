import { expect } from '@oclif/test';
import { ComponentConfigBuilder } from '../../../src/dependency-manager/src/component-config/builder';

describe('old service config merge', function () {
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
          'mount_path': '/simple'
        },
        'db_data': {
          'mount_path': '/db'
        }
      },
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
          'mount_path': '/new_db',
          'host_path': './new_db'
        }
      }
    };

    const component_config = ComponentConfigBuilder.buildFromJSONCompat(service_config_json);
    const env_config = ComponentConfigBuilder.buildFromJSONCompat(env_config_json);

    const merged_component_config = component_config.merge(env_config);

    expect(merged_component_config.getParameters()).keys('override', 'simple', 'overrideValueFrom');
    expect(merged_component_config.getParameters()['override'].default).eq('new');
    expect(merged_component_config.getParameters()['overrideValueFrom'].default).eq('new');
    expect(merged_component_config.getParameters()['simple'].default).eq('old');

    const node_config = merged_component_config.getServices()['service'];
    expect(node_config.getName()).eq('service');

    expect(node_config.getDebugOptions()!.getCommand()).members(['./test.ts']);

    expect(node_config.getVolumes()).keys('simple', 'db_data', 'new_db_data')
    expect(node_config.getVolumes().db_data.mount_path).eq('/db')
    expect(node_config.getVolumes().db_data.host_path).eq('./db')
    expect(node_config.getVolumes().new_db_data.mount_path).eq('/new_db')
    expect(node_config.getVolumes().new_db_data.host_path).eq('./new_db')
  });
});
