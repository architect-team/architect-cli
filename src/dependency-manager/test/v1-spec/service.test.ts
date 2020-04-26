import { expect } from 'chai';
import { BaseInterfaceConfig, BaseLivenessProbeConfig, BaseParameterValueConfig, BaseParameterValueFromConfig, BaseSubscriptionConfig, BaseValueFromDependencyConfig } from '../../src/configs/service-config';
import { ServiceSpecV1 } from '../../src/configs/v1-spec/service';

describe('service (v1 spec)', () => {
  describe('metadata', () => {
    it('should get name', () => {
      const spec = {
        name: 'tests/test',
      };

      const parsedSpec = new ServiceSpecV1(spec);
      expect(parsedSpec.getName()).to.equal(spec.name);
    });

    it('should set name', () => {
      const spec = {
        name: 'tests/test',
      };

      const newVal = 'updated/value';
      const parsedSpec = new ServiceSpecV1(spec);
      parsedSpec.setName(newVal);
      expect(parsedSpec.getName()).to.equal(newVal);
    });

    it('should get other metadata', () => {
      const spec = {
        description: 'Some description',
        tags: ['test', 'this'],
        language: 'node',
      };

      const parsedSpec = new ServiceSpecV1(spec);
      expect(parsedSpec.getMetadata().description).to.equal(spec.description);
      expect(parsedSpec.getMetadata().tags).to.eql(spec.tags);
      expect(parsedSpec.getMetadata().language).to.equal(spec.language);
    });

    it('should set metadata', () => {
      const spec = {
        description: 'Some description',
        tags: ['test', 'this'],
        language: 'node',
      };

      const newMetadata = {
        description: 'New description',
        tags: ['some', 'new', 'tags'],
        language: 'python',
      };
      const parsedSpec = new ServiceSpecV1(spec);
      parsedSpec.setMetadata(newMetadata)

      expect(parsedSpec.getMetadata().description).to.equal(newMetadata.description);
      expect(parsedSpec.getMetadata().tags).to.eql(newMetadata.tags);
      expect(parsedSpec.getMetadata().language).to.equal(newMetadata.language);
    });
  });

  describe('parameters', () => {
    it('should get parameters with string value', () => {
      const spec = {
        parameters: {
          PARAM: 'my-value',
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('default');

      param = param as BaseParameterValueConfig;
      expect(param.default).to.equal(spec.parameters.PARAM);
    });

    it('should get parameters with string default', () => {
      const spec = {
        parameters: {
          PARAM: {
            default: 'my-value',
          }
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('default');

      param = param as BaseParameterValueConfig;
      expect(param.default).to.equal(spec.parameters.PARAM.default);
    });

    it('should get other parameter options', () => {
      const spec = {
        parameters: {
          PARAM: {
            required: true,
            description: 'Some description',
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('required');
      expect(param).to.have.property('description');
      expect(param).not.to.have.property('default');
      expect(param).not.to.have.property('value_from');

      param = param as BaseParameterValueConfig;
      expect(param.required).to.equal(spec.parameters.PARAM.required);
      expect(param.description).to.equal(spec.parameters.PARAM.description);
    });

    it('should get value_from parameters', () => {
      const spec = {
        parameters: {
          PARAM: {
            value_from: {
              dependency: 'tests/dep',
              value: '$HOST'
            },
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('value_from');

      param = param as BaseParameterValueFromConfig;
      expect(param.value_from).to.have.property('dependency');
      expect(param.value_from).to.have.property('value');

      const value_from = param.value_from as BaseValueFromDependencyConfig;
      expect(value_from.dependency).to.equal(spec.parameters.PARAM.value_from.dependency);
      expect(value_from.value).to.equal(spec.parameters.PARAM.value_from.value);
    });

    it('should support alternative valueFrom syntax', () => {
      const spec = {
        parameters: {
          PARAM: {
            valueFrom: {
              dependency: 'tests/dep',
              value: '$HOST'
            },
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('value_from');

      param = param as BaseParameterValueFromConfig;
      expect(param.value_from).to.have.property('dependency');
      expect(param.value_from).to.have.property('value');

      const value_from = param.value_from as BaseValueFromDependencyConfig;
      expect(value_from.dependency).to.equal(spec.parameters.PARAM.valueFrom.dependency);
      expect(value_from.value).to.equal(spec.parameters.PARAM.valueFrom.value);
    });

    it('should support default value_from syntax', () => {
      const spec = {
        parameters: {
          PARAM: {
            default: {
              value_from: {
                dependency: 'tests/dep',
                value: '$HOST'
              },
            },
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('value_from');

      param = param as BaseParameterValueFromConfig;
      expect(param.value_from).to.have.property('dependency');
      expect(param.value_from).to.have.property('value');

      const value_from = param.value_from as BaseValueFromDependencyConfig;
      expect(value_from.dependency).to.equal(spec.parameters.PARAM.default.value_from.dependency);
      expect(value_from.value).to.equal(spec.parameters.PARAM.default.value_from.value);
    });

    it('should support alternative default valueFrom syntax', () => {
      const spec = {
        parameters: {
          PARAM: {
            default: {
              valueFrom: {
                dependency: 'tests/dep',
                value: '$HOST'
              },
            },
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('PARAM');

      let param = parameters.get('PARAM');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('value_from');

      param = param as BaseParameterValueFromConfig;
      expect(param.value_from).to.have.property('dependency');
      expect(param.value_from).to.have.property('value');

      const value_from = param.value_from as BaseValueFromDependencyConfig;
      expect(value_from.dependency).to.equal(spec.parameters.PARAM.default.valueFrom.dependency);
      expect(value_from.value).to.equal(spec.parameters.PARAM.default.valueFrom.value);
    });

    it('should get multiple param formats concurrently', () => {
      const spec = {
        parameters: {
          BASIC: 'value',
          NESTED: {
            description: 'Some description',
            default: 'value',
          },
          FROM: {
            value_from: {
              dependency: 'tests/dep',
              value: 'test'
            }
          }
        }
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(3);
      parameters.forEach((param, key) => {
        switch (key) {
          case 'BASIC':
            param = param as BaseParameterValueConfig;
            expect(param.default).equals(spec.parameters.BASIC);
            break;
          case 'NESTED':
            param = param as BaseParameterValueConfig;
            expect(param.default).equals(spec.parameters.NESTED.default);
            break;
          case 'FROM':
            param = param as BaseParameterValueFromConfig;
            expect(param.value_from).to.have.property('dependency');
            expect(param.value_from).to.have.property('value');
            const value_from = param.value_from as BaseValueFromDependencyConfig;
            expect(value_from.dependency).to.equal(spec.parameters.FROM.value_from.dependency);
            expect(value_from.value).to.equal(spec.parameters.FROM.value_from.value);
            break;
          default:
            throw new Error('Unexpected validation error');
        }
      });
    });

    it('should set basic parameter', () => {
      const parsedObj = new ServiceSpecV1();
      let parameters = parsedObj.getParameters();
      expect(parameters.size).to.equal(0);

      parameters.set('BASIC', {
        default: 'value'
      });
      parsedObj.setParameters(parameters);
      parameters = parsedObj.getParameters();
      expect(parameters.size).to.equal(1);

      let param = parameters.get('BASIC');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('default');
      param = param as BaseParameterValueConfig;
      expect(param.default).to.equal('value');
    });

    it('should set complex parameter', () => {
      const parsedObj = new ServiceSpecV1();
      let parameters = parsedObj.getParameters();
      expect(parameters.size).to.equal(0);

      parameters.set('COMPLEX', {
        value_from: {
          dependency: 'tests/dep',
          value: 'value-from',
        },
      });
      parsedObj.setParameters(parameters);
      parameters = parsedObj.getParameters();
      expect(parameters.size).to.equal(1);

      let param = parameters.get('COMPLEX');
      expect(param).not.to.be.undefined;
      expect(param).to.have.property('value_from');
      param = param as BaseParameterValueFromConfig;
      expect(param.value_from).to.have.property('dependency');
      expect(param.value_from).to.have.property('value');
      const value_from = param.value_from as BaseValueFromDependencyConfig;
      expect(value_from.dependency).to.equal('tests/dep');
      expect(value_from.value).to.equal('value-from');
    });
  });

  describe('dependencies', () => {
    it('should get dependencies with shorthand refs', () => {
      const spec = {
        dependencies: {
          'account/service': 'latest'
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const dependencies = parsedSpec.getDependencies();
      expect(dependencies.length).to.equal(1);
      expect(dependencies[0].getRef()).to.equal('latest');
      expect(dependencies[0].getName()).to.equal('account/service');
    });

    it('should get dependencies with nested service spec', () => {
      const spec = {
        dependencies: {
          'account/service': {
            name: 'account/service',
            interfaces: {
              default: {
                port: 8080,
              },
            },
            parameters: {
              NESTED_PARAM: 'value',
            },
          },
        },
      };

      const parsedObj = new ServiceSpecV1(spec);
      const dependencies = parsedObj.getDependencies();
      expect(dependencies.length).to.equal(1);
      expect(dependencies[0].getName()).to.equal('account/service');

      const dependency = dependencies[0];
      expect(dependency.getName()).to.equal(spec.dependencies['account/service'].name);
      expect(dependency.getParameters().size).to.equal(1);
      expect(dependency.getParameters()).to.have.key('NESTED_PARAM');

      const param = dependency.getParameters().get('NESTED_PARAM') as BaseParameterValueConfig;
      expect(param.default).to.equal(spec.dependencies['account/service'].parameters.NESTED_PARAM);
    });

    it('should set simple dependency', () => {
      const spec = {
        interfaces: {
          default: {
            port: 8080,
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      let dependencies = parsedSpec.getDependencies();
      const newDep = new ServiceSpecV1();
      newDep.setName('tests/dep');
      newDep.setRef('latest');
      dependencies.push(newDep);
      parsedSpec.setDependencies(dependencies);
      dependencies = parsedSpec.getDependencies();

      expect(dependencies.length).to.equal(1);
      expect(dependencies[0].getName()).to.equal('tests/dep');
      expect(dependencies[0].getRef()).to.equal('latest');
    });

    it('should set nested service config as dependency', () => {
      const spec = {
        interfaces: {
          default: {
            port: 8080,
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      let dependencies = parsedSpec.getDependencies();

      const nestedSpec = new ServiceSpecV1({
        name: 'tests/dep',
      });
      dependencies.push(nestedSpec);
      parsedSpec.setDependencies(dependencies);
      dependencies = parsedSpec.getDependencies();
      expect(dependencies.length).to.equal(1);

      let dep = dependencies[0];
      expect(dep.getName()).to.equal('tests/dep');
    });
  });

  describe('interfaces', () => {
    it('should get port as interface', () => {
      const spec = {
        port: 8080
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const interfaces = parsedSpec.getInterfaces();
      expect(interfaces.size).to.equal(1);
      expect(interfaces).to.have.key('default');

      const i = interfaces.get('default');
      expect(i).not.to.be.undefined;
      expect(i!.port).to.equal(spec.port);
    });

    it('should get declared interfaces', () => {
      const spec = {
        interfaces: {
          web: {
            port: 8080
          },
          admin: {
            description: 'Admin API',
            port: 8081
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const interfaces = parsedSpec.getInterfaces();
      expect(interfaces.size).to.equal(2);
      interfaces.forEach((value, key) => {
        switch (key) {
          case 'web':
            expect(value.port).to.equal(spec.interfaces.web.port);
            expect(value.description).to.be.undefined;
            break;
          case 'admin':
            expect(value.port).to.equal(spec.interfaces.admin.port);
            expect(value.description).to.equal(spec.interfaces.admin.description);
            break;
          default:
            throw new Error('Unexpected validation error');
        }
      });
    });

    it('should ignore port if interfaces exist', () => {
      const spec = {
        port: 8080,
        interfaces: {
          main: {
            port: 8081
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const interfaces = parsedSpec.getInterfaces();
      expect(interfaces.size).to.equal(1);
      expect(interfaces).to.have.key('main');

      const main = interfaces.get('main');
      expect(main).not.to.be.undefined;
      expect(main!.port).to.equal(spec.interfaces.main.port);
    });

    it('should set new interfaces', () => {
      const parsedSpec = new ServiceSpecV1();
      let interfaces = new Map<string, BaseInterfaceConfig>();

      interfaces.set('main', { port: 8080 });
      parsedSpec.setInterfaces(interfaces);
      interfaces = parsedSpec.getInterfaces();
      expect(interfaces.size).to.equal(1);
      expect(interfaces).to.have.key('main');

      const main = interfaces.get('main');
      expect(main).not.to.be.undefined;
      expect(main!.port).to.equal(8080);
    });
  });

  describe('volumes', () => {
    it('should get declared volumes', () => {
      const spec = {
        volumes: {
          image_store: {
            description: 'Container path',
            mount_path: '/container/path',
            readonly: true,
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const volumes = parsedSpec.getVolumes();
      expect(volumes.size).to.equal(1);
      expect(volumes).to.have.keys('image_store');

      const image_store = volumes.get('image_store')!;
      expect(image_store).not.to.be.undefined;
      expect(image_store.mount_path).to.equal(spec.volumes.image_store.mount_path);
      expect(image_store.description).to.equal(spec.volumes.image_store.description);
      expect(image_store.readonly).to.equal(spec.volumes.image_store.readonly);
    });

    it('should set new volumes', () => {
      const parsedSpec = new ServiceSpecV1();
      let volumes = parsedSpec.getVolumes();
      expect(volumes.size).to.equal(0);

      volumes.set('store', { mount_path: '/test' });
      parsedSpec.setVolumes(volumes);
      volumes = parsedSpec.getVolumes();
      expect(volumes.size).to.equal(1);
      expect(volumes).to.have.key('store');

      const store = volumes.get('store');
      expect(store).not.to.be.undefined;
      expect(store!.mount_path).to.equal('/test');
      expect(store!.description).to.be.undefined;
      expect(store!.readonly).to.be.undefined;
    });
  });

  describe('docker build/run', () => {
    it('should get defined command', () => {
      const spec = {
        command: ['my', 'command'],
      };

      const parsedSpec = new ServiceSpecV1(spec);
      expect(parsedSpec.getCommand()).to.eql(spec.command);
    });

    it('should get defined entrypoint', () => {
      const spec = {
        entrypoint: ['my', 'entrypoint'],
      };

      const parsedSpec = new ServiceSpecV1(spec);
      expect(parsedSpec.getEntrypoint()).to.eql(spec.entrypoint);
    });

    it('should get docker image', () => {
      const spec = {
        image: 'postgres:11',
      };

      const parsedSpec = new ServiceSpecV1(spec);
      expect(parsedSpec.getImage()).to.equal(spec.image);
    });

    it('should set docker image', () => {
      const parsedSpec = new ServiceSpecV1();
      expect(parsedSpec.getImage()).to.be.undefined;
      parsedSpec.setImage('Dockerfile');
      expect(parsedSpec.getImage()).to.equal('Dockerfile');
    });

    it('should set command', () => {
      const parsedSpec = new ServiceSpecV1();
      expect(parsedSpec.getCommand()).to.be.undefined;
      parsedSpec.setCommand('./command.sh');
      expect(parsedSpec.getCommand()).to.equal('./command.sh');
    });

    it('should set entrypoint', () => {
      const parsedSpec = new ServiceSpecV1();
      expect(parsedSpec.getEntrypoint()).to.be.undefined;
      parsedSpec.setEntrypoint('./command.sh');
      expect(parsedSpec.getEntrypoint()).to.equal('./command.sh');
    });
  });

  describe('liveness probe', () => {
    it('should get liveness probe', () => {
      const spec = {
        api: {
          liveness_probe: {
            success_threshold: 3,
            failure_threshold: 1,
            timeout: '5s',
            path: '/path',
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const liveness_probe = parsedSpec.getLivenessProbe()!;
      expect(Object.keys(liveness_probe).length).to.equal(4);
      expect(liveness_probe).to.have.keys([
        'success_threshold',
        'failure_threshold',
        'timeout',
        'path',
      ]);
      expect(liveness_probe.success_threshold).to.equal(spec.api.liveness_probe.success_threshold);
      expect(liveness_probe.failure_threshold).to.equal(spec.api.liveness_probe.failure_threshold);
      expect(liveness_probe.timeout).to.equal(spec.api.liveness_probe.timeout);
      expect(liveness_probe.path).to.equal(spec.api.liveness_probe.path);
      expect(liveness_probe.interval).to.be.undefined;
    });

    it('should set liveness probe', () => {
      const parsedSpec = new ServiceSpecV1();
      let liveness_probe = parsedSpec.getLivenessProbe() as BaseLivenessProbeConfig;
      expect(liveness_probe).to.be.undefined;

      liveness_probe = {
        path: '/path',
      };
      parsedSpec.setLivenessProbe(liveness_probe);
      liveness_probe = parsedSpec.getLivenessProbe()!;
      expect(Object.keys(liveness_probe).length).to.equal(1);
      expect(liveness_probe.path).to.equal('/path');
    });
  });

  describe('notifications/subscriptions', () => {
    it('should get declared notifications', () => {
      const spec = {
        name: 'tests/test',
        interfaces: {
          default: {
            port: 8080,
          },
        },
        notifications: {
          user_created: {
            description: 'Some description',
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const notifications = parsedSpec.getNotifications();
      expect(notifications.size).to.equal(1);
      expect(notifications).to.have.key('user_created');

      const user_created = notifications.get('user_created');
      expect(user_created).not.to.be.undefined;
      expect(user_created!.description).to.equal(spec.notifications.user_created.description);
    });

    it('should set new notifications', () => {
      const parsedSpec = new ServiceSpecV1();
      let notifications = parsedSpec.getNotifications();
      expect(notifications.size).to.equal(0);
      notifications.set('user_deleted', {
        description: 'Deleted a user',
      });
      parsedSpec.setNotifications(notifications);
      notifications = parsedSpec.getNotifications();
      expect(notifications.size).to.equal(1);
      expect(notifications).to.have.key('user_deleted');
      expect(notifications.get('user_deleted')!.description).to.equal('Deleted a user');
    });

    it('should get declared subscriptions', () => {
      const spec = {
        subscriptions: {
          'test/sub': {
            'my-event': {
              uri: '/test',
              headers: {
                AUTHORIZATION: 'Bearer test'
              }
            }
          }
        }
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const subscriptions = parsedSpec.getSubscriptions();
      expect(subscriptions.size).to.equal(1);
      expect(subscriptions).to.have.key('test/sub');

      const service = subscriptions.get('test/sub');
      expect(service).not.to.be.undefined;
      expect(service!.size).to.equal(1);
      expect(service).to.have.key('my-event');

      const event = service!.get('my-event');
      expect(event).not.to.be.undefined;
      expect(event).to.have.property('uri');
      expect(event).to.have.property('headers');
      expect(event!.uri).to.equal(spec.subscriptions['test/sub']['my-event'].uri);
      expect(event!.headers.size).to.equal(1);
      expect(event!.headers).to.have.key('AUTHORIZATION');

      const authorization = event!.headers.get('AUTHORIZATION');
      expect(authorization).to.equal(spec.subscriptions['test/sub']['my-event'].headers.AUTHORIZATION);
    });

    it('should set new subscriptions', () => {
      const parsedSpec = new ServiceSpecV1();
      let subscriptions = parsedSpec.getSubscriptions();
      expect(subscriptions.size).to.equal(0);

      const newSub = new Map<string, BaseSubscriptionConfig>();
      newSub.set('user_deleted', {
        uri: '/test',
        headers: new Map(),
      });
      subscriptions.set('tests/sub', newSub);
      parsedSpec.setSubscriptions(subscriptions);
      subscriptions = parsedSpec.getSubscriptions();
      expect(subscriptions.size).to.equal(1);
      expect(subscriptions).to.have.key('tests/sub');

      const sub = subscriptions.get('tests/sub');
      expect(sub).not.to.be.undefined;
      expect(sub!.size).to.equal(1);
      expect(sub).to.have.key('user_deleted');
      expect(sub!.get('user_deleted')!.uri).to.equal('/test');
    });
  });

  describe('platforms', () => {
    it('should get defined platform configs', () => {
      const spec = {
        platforms: {
          'docker-compose': {
            privileged: true,
          },
        },
      };

      const parsedSpec = new ServiceSpecV1(spec);
      const platforms = parsedSpec.getPlatformsConfig();
      expect(platforms).to.have.property('docker-compose');

      const compose = platforms['docker-compose']!;
      expect(compose).to.have.property('privileged');
      expect(compose.privileged).to.equal(spec.platforms['docker-compose'].privileged);
      expect(compose.stop_signal).to.be.undefined;
    });

    it('should set new platform configs', () => {
      const parsedSpec = new ServiceSpecV1();
      let platforms = parsedSpec.getPlatformsConfig();
      expect(Object.keys(platforms).length).to.equal(0);
      platforms['docker-compose'] = {
        stop_signal: 'signal',
      };
      parsedSpec.setPlatformsConfig(platforms);
      platforms = parsedSpec.getPlatformsConfig();
      expect(Object.keys(platforms).length).to.equal(1);
      expect(platforms).to.have.property('docker-compose');
      expect(platforms!['docker-compose']!.stop_signal).to.equal('signal');
    });
  });
});
