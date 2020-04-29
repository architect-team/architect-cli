import { expect } from 'chai';
import { flattenValidationErrors } from '../../src/common/utils/errors';
import { ServiceConfigBuilder } from '../../src/dependency-manager/src';

describe('validation (v1 spec)', () => {
  describe('services', () => {
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
      expect(Object.keys(flattened_errors)).to.include('parameters.SECRET.default.valueFrom.vault');
      expect(flattened_errors['parameters.SECRET.default.valueFrom.vault']).to.include({
        isEmpty: 'Services cannot hardcode references to private secret stores'
      });
    });

    it('should not allow host_paths in volume claims', async () => {
      const spec = {
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

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
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

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
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

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(flattened_errors).to.have.key('parameters.PARAM.default.valueFrom.dependency');
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

      const parsedSpec = ServiceConfigBuilder.buildFromJSON(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      const flattened_errors = flattenValidationErrors(errors);
      expect(flattened_errors).to.have.key('parameters.PARAM.default.valueFrom.datastore');
      expect(flattened_errors['parameters.PARAM.default.valueFrom.datastore']).to.include({
        isEmpty: 'Datastore values are only accessible to direct consumers'
      });
    });
  });
});
