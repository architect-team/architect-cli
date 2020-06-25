import { expect } from 'chai';
import mock_fs from 'mock-fs';
import { EnvironmentConfigBuilder } from '../../../src/dependency-manager/src';
import { ComponentConfigBuilder } from '../../../src/dependency-manager/src/component-config/builder';
import { flattenValidationErrors } from '../../../src/dependency-manager/src/utils/errors';
import { ARC_ENV_CONFIG } from './architect-components.test';

describe('old validation (v1 spec)', () => {
  afterEach(function () {
    // Restore fs
    mock_fs.restore();
  });

  describe('services', () => {
    it('should not allow nested debug blocks', async () => {
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
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
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
        name: 'test/test',
        debug: {
          path: '/some/path'
        },
      });
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('extends');
      expect(flattened_errors['extends']).to.include({
        matches: 'Cannot hardcode a filesystem location when registering a component',
      });
    });

    it('should allow debug paths when operating', async () => {
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
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

    /*
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

      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members(['parameters.SECRET.default.valueFrom.key', 'parameters.SECRET.default.valueFrom.vault']);
      expect(flattened_errors['parameters.SECRET.default.valueFrom.vault']).to.include({
        isEmpty: 'Services cannot hardcode references to private secret stores'
      });
    });
    */

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

      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('volumes.image_store.host_path');
      expect(flattened_errors['volumes.image_store.host_path']).to.include({
        isEmpty: 'Cannot hardcode a host mount path in a component outside of the debug block',
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

      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat(spec);
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
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
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
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
        name: 'test',
      });
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).to.include('name');
      expect(flattened_errors['name']).to.include({
        matches: 'Names must be prefixed with an account name (e.g. architect/component-name)',
      });
    });

    it('should allow services being operated without an account namespace', async () => {
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
        name: 'test',
      });
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(0);
    });

    it('typos', async () => {
      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat({
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
          "NODE_ENV": {},
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

      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat(service_config);
      const errors = await parsedSpec.validate({
        groups: ['developer'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members([]);
      expect(errors.length).to.equal(0);
    });
  });

  describe('environments', () => {
    /*
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
    */

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
      expect(Object.keys(flattened_errors)).members(['parameters.PARAM.value_from']);
      expect(flattened_errors['parameters.PARAM.value_from']).to.include({
        whitelistValidation: 'property value_from should not exist'
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
      expect(Object.keys(flattened_errors)).members(['parameters.PARAM.value_from']);
      expect(flattened_errors['parameters.PARAM.value_from']).to.include({
        whitelistValidation: 'property value_from should not exist'
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
        components: {
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
      expect(Object.keys(flattened_errors)).members(['components.api.parameter']);
    });

    it('key matches', async () => {
      const spec = {
        parameters: {
          'GCP*KEY': 'invalid',
          'gcp-key': 'invalid'
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
      const env_config = ARC_ENV_CONFIG;

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
        await ComponentConfigBuilder.buildFromPath('/stack/')
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
        await ComponentConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }
      expect(Object.keys(config_err)).members(['debug.debug']);
      expect(config_err['debug.debug'].line).to.eq(1);
    });

    it('debug parameter value', async () => {
      const service_config = {
        name: 'test/test',
        debug: {
          parameters: {
            TEST: {
              default: 'test'
            }
          }
        },
      };
      mock_fs({
        '/stack/architect.json': JSON.stringify(service_config, null, 2),
      });

      await ComponentConfigBuilder.buildFromPath('/stack/');
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
        await ComponentConfigBuilder.buildFromPath('/stack/')
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
        await ComponentConfigBuilder.buildFromPath('/stack/')
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
        await ComponentConfigBuilder.buildFromPath('/stack/')
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
        await ComponentConfigBuilder.buildFromPath('/stack/')
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

      const parsedSpec = ComponentConfigBuilder.buildFromJSONCompat(service_config);
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
      expect(Object.keys(flattened_errors)).members([
        'services.architect/registry:latest.liveness_probe.command',
        'services.architect/registry:latest.liveness_probe.path',
        'services.architect/registry:latest.liveness_probe.port',
      ]);
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
        await ComponentConfigBuilder.buildFromPath('/stack/')
      } catch (err) {
        config_err = JSON.parse(err.message);
      }

      expect(Object.keys(config_err)).members(['liveness_probe.path', 'liveness_probe.command', 'liveness_probe.port']);
      expect(config_err['liveness_probe.path']).to.include({ isString: 'path must be a string' });
      expect(config_err['liveness_probe.port']).to.include({ isNotEmpty: 'port should not be empty' });
      expect(config_err['liveness_probe.command']).to.include({ isString: 'each value in command must be a string' });
    });

    it('should require an operator to specify a port if a host is specified', async () => {
      const env_config = {
        "services": {
          "architect/registry:latest": {
            "interfaces": {
              "main": {
                "host": "172.0.1.2"
              },
            },
          },
        },
      };

      const parsedSpec = EnvironmentConfigBuilder.buildFromJSON(env_config);
      const errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(Object.keys(flattened_errors)).members([
        'services.architect/registry:latest.interfaces.main.port',
      ]);
      expect(errors.length).to.equal(1);
    });
  });
});
