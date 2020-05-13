import { expect } from 'chai';
import mock_fs from 'mock-fs';
import { EnvironmentConfigBuilder, ServiceConfigBuilder } from '../../src/dependency-manager/src';
import { flattenValidationErrors } from '../../src/dependency-manager/src/utils/errors';

describe('validation (v1 spec)', () => {
  afterEach(function () {
    // Restore fs
    mock_fs.restore();
  });

  describe('services', () => {
    it('should not allow nested debug blocks', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test/test',
        debug: {
          command: 'debug',
          debug: {
            command: 'debug2',
          }
        },
      });
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('debug.debug');
    });

    it('should not allow hardcoded filesystem debug paths when publishing', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test/test',
        debug: {
          path: '/some/path'
        },
      });
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('debug.path');
      expect(flattened_errors['debug.path']).to.include({
        isEmpty: 'Cannot hardcode a filesystem location when registering a service',
      });
    });

    it('should allow debug paths when operating', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test/test',
        debug: {
          path: '/some/path'
        },
      });
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(0);
    });

    it('should not allow value_from vaults in service configs', async () => {
      const spec = {
        name: 'architect/test',
        parameters: {
          SECRET: {
            value_from: {
              vault: 'my-vault',
              key: 'folder/secret#key'
            },
          },
        },
      };

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['parameters.SECRET.default.valueFrom.key', 'parameters.SECRET.default.valueFrom.vault']);
      expect(flattened_errors['parameters.SECRET.default.valueFrom.vault']).to.include({
        isEmpty: 'Services cannot hardcode references to private secret stores'
      });
    });

    it('should not allow host_paths in volume claims', async () => {
      const spec = {
        name: 'architect/test',
        volumes: {
          image_store: {
            mount_path: '/app/images',
            host_path: '/Users/architect/my-service/images',
            description: 'My images',
            readonly: true
          },
        },
      };

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('volumes.image_store.host_path');
      expect(flattened_errors['volumes.image_store.host_path']).to.include({
        isEmpty: 'Cannot hardcode a host mount path when registering a service',
      });
    });

    it('should require host paths in debug volumes', async () => {
      const spec = {
        name: 'architect/test',
        debug: {
          volumes: {
            image_store: {
              mount_path: '/app/images',
              description: 'My images',
              readonly: true
            },
          },
        }
      };

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('debug.volumes.image_store.host_path');
      expect(flattened_errors['debug.volumes.image_store.host_path']).to.include({
        isNotEmpty: 'Debug volumes require a host path to mount the volume to',
      });
    });

    it('should reject service names with bad characters', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test/test$$test',
      });
      const errors = await parsedSpec.validate();
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('name');
      expect(flattened_errors['name']).to.include({
        matches: 'Names must only include letters, numbers, dashes, and underscores',
      });
    });

    it('should reject services being published without an account namespace', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test',
      });
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(flattened_errors).to.have.key('name');
      expect(flattened_errors['name']).to.include({
        matches: 'Names must be prefixed with an account name (e.g. architect/service-name)',
      });
    });

    it('should allow services being operated without an account namespace', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test',
      });
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(0);
    });

    it('typos', async () => {
      const parsedSpec = ServiceConfigBuilder.buildFromJSON({
        name: 'test',
        TYPO: 'typo'
      });
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(1);
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['TYPO']);
    });

    it('api config', async () => {
      const service_config = {
        "name": "architect/cloud-api",
        "description": "API powering the Architect Hub and related clients and services",
        "keywords": [
          "architect",
          "docker",
          "node"
        ],
        "author": "Architect.io",
        "dependencies": {
          "architect/dep1": "latest",
          "architect/dep2": "latest",
        },
        "language": "node",
        "api": {
          "type": "rest"
        },
        "interfaces": {
          "main": 8080
        },
        "datastores": {
          "primary": {
            "image": "postgres:11",
            "port": 5432,
            "parameters": {
              "POSTGRES_USER": {
                "default": "postgres"
              },
              "POSTGRES_PASSWORD": {
                "default": "architect"
              },
              "POSTGRES_DB": {
                "default": "architect_cloud_api"
              }
            }
          }
        },
        "parameters": {
          "NODE_ENV": {
            "build_arg": true
          },
          "DEFAULT_REGISTRY_HOST": {
            "description": "Public hostname used to resolve the registry from deployment environments"
          },
          "DB_HOST": {
            "default": {
              "valueFrom": {
                "datastore": "primary",
                "value": "$HOST"
              }
            }
          },
          "DEFAULT_INTERNAL_REGISTRY_HOST": {
            "default": {
              "valueFrom": {
                "dependency": "architect/dep1:latest",
                "value": "$HOST:$PORT"
              }
            }
          },
          "ENABLE_SCHEDULE": {
            "description": "Enable scheduled jobs",
            "default": false
          }
        },
        "debug": {
          "command": "npm run start:dev",
          "volumes": {
            "src": {
              "mount_path": "/src",
              "host_path": "./src"
            },
            "test": {
              "mount_path": "/test",
              "host_path": "./test"
            }
          }
        }
      }

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(service_config);
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members([]);
      expect(errors.length).to.equal(0);
    });
  });

  describe('environments', () => {
    it('should support value_from vault from global parameters', async () => {
      const spec = {
        parameters: {
          GCP_KEY: {
            value_from: {
              vault: 'my-vault',
              key: 'folder/secret#key',
            },
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator']
      });
      expect(errors.length).to.equal(0);
    });

    it('should support value_from vault from service parameters', async () => {
      const spec = {
        services: {
          'my-service': {
            parameters: {
              GCP_KEY: {
                value_from: {
                  vault: 'my-vault',
                  key: 'folder/secret#key',
                },
              },
            },
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator']
      });
      expect(errors.length).to.equal(0);
    });

    it('should reject value_from dependency from global parameters', async () => {
      const spec = {
        parameters: {
          PARAM: {
            value_from: {
              dependency: 'my-dep',
              value: '$HOST'
            },
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['parameters.PARAM.default.valueFrom.dependency', 'parameters.PARAM.default.valueFrom.value']);
      expect(flattened_errors['parameters.PARAM.default.valueFrom.dependency']).to.include({
        isEmpty: 'Service values are only accessible to direct consumers'
      });
    });

    it('should reject value_from datastore from global parameters', async () => {
      const spec = {
        parameters: {
          PARAM: {
            value_from: {
              datastore: 'postgres',
              value: '$HOST'
            },
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['parameters.PARAM.default.valueFrom.datastore', 'parameters.PARAM.default.valueFrom.value']);
      expect(flattened_errors['parameters.PARAM.default.valueFrom.datastore']).to.include({
        isEmpty: 'Datastore values are only accessible to direct consumers'
      });
    });

    it('typo', async () => {
      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON({
        name: 'test',
      });
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(1);
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['name']);
    });

    it('nested typo', async () => {
      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON({
        services: {
          api: {
            parameter: {
              TEST: 0
            }
          }
        }
      });
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(1);
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['services.api.parameter']);
    });

    it('key matches', async () => {
      const spec = {
        parameters: {
          'GCP*KEY': {
            value_from: {
              vault: 'my-vault',
              key: 'folder/secret#key',
            },
          },
          'gcp-key': {
            value_from: {
              vault: 'my-vault',
              key: 'folder/secret#key',
            },
          }
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator']
      });

      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['parameters.GCP*KEY', 'parameters.gcp-key']);
      expect(errors.length).to.equal(1);
    });

    it('architect config', async () => {
      const env_config = {
        "services": {
          "architect/registry:latest": {
            "debug": {
              "path": "../docker-registry/registry"
            },
            "parameters": {
              "NOTIFICATION_URL": "http://architect.cloud-api.latest:8080"
            }
          },
          "architect/registry-proxy:latest": {
            "debug": {
              "path": "../docker-registry"
            },
            "parameters": {
              "CLOUD_API_BASE_URL": "http://architect.cloud-api.latest:8080",
              "CLOUD_API_SECRET": "test",
              "NODE_ENV": "development"
            }
          },
          "architect/cloud-api:latest": {
            "debug": {
              "path": "../cloud-api",
              "volumes": {
                "src": "../cloud-api/src",
                "test": "../cloud-api/test"
              }
            },
            "interfaces": {
              "main": {
                "subdomain": "api"
              }
            },
            "parameters": {
              "NODE_ENV": "local",
              "OAUTH_CLIENT_SECRET": {
                "valueFrom": {
                  "vault": "local_vault",
                  "key": "architect_local/api#OAUTH_CLIENT_SECRET"
                }
              },
              "SEGMENT_WRITE_KEY": "test"
            },
            "datastores": {
              "primary": {
                "host": "host.docker.internal"
              }
            }
          },
          "architect/cloud:latest": {
            "debug": {
              "path": "../architect-cloud",
              "volumes": {
                "src": "./src"
              }
            },
            "interfaces": {
              "main": {
                "subdomain": "app"
              }
            },
            "parameters": {
              "ENVIRONMENT": "local",
            }
          },
          "concourse/web:latest": {
            "debug": {
              "path": "../cloud-api/concourse/web"
            },
            "interfaces": {
              "main": {
                "subdomain": "ci"
              }
            },
            "volumes": {
              "web-keys": "../cloud-api/concourse/keys/web"
            },
            "parameters": {
              "CONCOURSE_LOG_LEVEL": "error",
              "CONCOURSE_VAULT_AUTH_PARAM": {
                "valueFrom": {
                  "vault": "local_vault",
                  "key": "architect_local/concourse#CONCOURSE_VAULT_AUTH_PARAM"
                }
              }
            },
            "datastores": {
              "primary": {
                "host": "host.docker.internal"
              }
            }
          },
          "concourse/worker:latest": {
            "debug": {
              "path": "../cloud-api/concourse/worker"
            },
            "volumes": {
              "worker-keys": "../cloud-api/concourse/keys/worker"
            },
            "parameters": {
              "CONCOURSE_LOG_LEVEL": "error",
              "CONCOURSE_BAGGAGECLAIM_LOG_LEVEL": "error",
              "CONCOURSE_GARDEN_LOG_LEVEL": "error"
            }
          }
        },
        "vaults": {
          "local_vault": {
            "host": "http://0.0.0.0",
            "type": "hashicorp-vault",
            "description": "Secret store for local development",
            "role_id": "test",
            "secret_id": "file:~/secret"
          }
        }
      }

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(env_config);
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members([]);
      expect(errors.length).to.equal(0);
    })
  });

  describe('file validation', () => {
    it('should not allow nested debug blocks with line number', async () => {
      const service_config = {
        name: 'test/test',
        debug: {
          command: 'debug',
          debug: {
            command: 'debug2',
          }
        },
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['debug.debug']);
      expect(config_err['debug.debug'].line).to.eq(5);
    });

    it('should not allow nested debug blocks with line number/single line', async () => {
      const service_config = {
        name: 'test/test',
        debug: {
          command: 'debug',
          debug: {
            command: 'debug2',
          }
        },
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['debug.debug']);
      expect(config_err['debug.debug'].line).to.eq(1);
    });

    it('parameter value_from error', async () => {
      const service_config = {
        name: 'test/test',
        debug: {
          parameters: {
            TEST: {
              default: {
                valueFrom: {
                  dependency: "foo",
                  value: 'bar',
                  invalid: "baz"
                }
              }
            }
          }
        },
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['debug.parameters.TEST.default.valueFrom.invalid']);
      expect(config_err['debug.parameters.TEST.default.valueFrom.invalid'].line).to.eq(10);
    });

    it('multiple author keys (first invalid) line number/single line', async () => {
      const service_config = {
        name: 'test/test',
        author: 5,
        debug: {
          author: 'debug'
        },
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['author']);
      expect(config_err['author'].line).to.eq(3);
    });

    it('multiple author keys (second invalid) line number/single line', async () => {
      const service_config = {
        name: 'test/test',
        debug: {
          author: 'debug'
        },
        author: 5,
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['author']);
      expect(config_err['author'].line).to.eq(6);
    });

    it('multiple author keys (middle invalid) line number/single line', async () => {
      const service_config = {
        name: 'test/test',
        debug: {
          author: 'debug'
        },
        author: 5,
        parameters: {
          author: 'debug'
        }
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['author']);
      expect(config_err['author'].line).to.eq(6);
    });

    it('should not allow nested debug blocks with line number (yaml)', async () => {
      const service_config = `
      name: test/test
      debug:
        command: debug
        debug:
          command: debug2
      `;
      mock_fs({
        '/stack/architect.yaml': service_config,
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).to.include('debug.debug');
      expect(config_err['debug.debug'].line).to.eq(5);
    });

    it('should require a port for a developer', async () => {
      const service_config = {
        "name": "architect/test-service",
        "interfaces": {
          "main": {}
        },
      };

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(service_config);
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['interfaces.main.port']);
      expect(errors.length).to.equal(1);
    });

    it('should not require a port for an operator', async () => {
      const env_config = {
        "services": {
          "architect/registry:latest": {
            "interfaces": {
              "main": {
                "subdomain": "test"
              }
            }
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(env_config);
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members([]);
      expect(errors.length).to.equal(0);
    });

    it('should reject the use of both a command and path in a liveness probe', async () => {
      const env_config = {
        "services": {
          "architect/registry:latest": {
            "liveness_probe": {
              "path": "/test",
              "command": "test",
              "interval": "10s"
            }
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(env_config);
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['services.architect/registry:latest.liveness_probe']);
      expect(errors.length).to.equal(1);
    });

    it('should require that a liveness probe defines either a command or a path', async () => {
      const service_config = {
        "name": "architect/test-service",
        "liveness_probe": {}
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      let config_err;
      try {
        await ServiceConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }

      expect(Object.keys(config_err)).members(['liveness_probe']);
      expect(config_err['liveness_probe'].line).to.eq(3);
    });
  });
});
