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
          'mount_path': '/simple'
        },
        'db_data': {
          'mount_path': '/db'
        }
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
          'mount_path': '/new_db',
          'host_path': './new_db'
        }
      }
    };

    const service_config = ServiceConfigBuilder.buildFromJSON(service_config_json);

    (service_config.getDependencies()['override'] as any).author = 'before';
    const copied_service_config = service_config.copy();
    copied_service_config.addDependency('new-dep', 'newest');
    expect(copied_service_config.getDependencies()).keys(['no_override', 'override', 'new-dep']);
    expect(service_config.getDependencies()).keys(['no_override', 'override']);

    expect((service_config.getDependencies()['override'] as any).author).eq('before');
    expect((copied_service_config.getDependencies()['override'] as any).author).eq('before');
    (copied_service_config.getDependencies()['override'] as any).author = 'after';
    expect((service_config.getDependencies()['override'] as any).author).eq('before');
    expect((copied_service_config.getDependencies()['override'] as any).author).eq('after');

    const env_config = ServiceConfigBuilder.buildFromJSON(env_config_json);

    const node_config = service_config.merge(env_config);
    expect(service_config.getDependencies()['override'].getRef()).eq('override:old');  // Make sure we don't mutate the initial config

    expect(node_config.getName()).eq('foo/service');

    expect(node_config.getDependencies()).keys('override', 'no_override');
    expect(node_config.getDependencies()['override'].getRef()).eq('override:new');
    expect(node_config.getDependencies()['no_override'].getRef()).eq('no_override:old');

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

    expect(node_config.getDebugOptions()!.getCommand()).members(['./test.ts']);

    expect(node_config.getVolumes()).keys('simple', 'db_data', 'new_db_data')
    expect(node_config.getVolumes().db_data.mount_path).eq('/db')
    expect(node_config.getVolumes().db_data.host_path).eq('./db')
    expect(node_config.getVolumes().new_db_data.mount_path).eq('/new_db')
    expect(node_config.getVolumes().new_db_data.host_path).eq('./new_db')
  });
});
