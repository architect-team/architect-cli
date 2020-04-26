import { expect } from 'chai';
import { EnvironmentSpecV1 } from '../../src/configs/v1-spec/environment';
import { ServiceSpecV1 } from '../../src/configs/v1-spec/service';

describe('validation (v1 spec)', () => {
  describe('services', () => {
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

      const parsedSpec = new ServiceSpecV1(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      expect(errors).not.to.be.undefined;
      expect(errors.length).to.equal(1);
      expect(errors[0].property).to.equal('parameters');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('SECRET');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('value_from');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].constraints).to.include({
        isEmpty: 'Services cannot hardcode references to private secret stores',
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

      const parsedSpec = new ServiceSpecV1(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      expect(errors).not.to.be.undefined;
      expect(errors.length).to.equal(1);
      expect(errors[0].property).to.equal('volumes');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('image_store');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('host_path');
      expect(errors[0].constraints).to.include({
        isEmpty: 'Volumes can\'t define hardcoded host mount paths',
      })
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

      const parsedSpec = new ServiceSpecV1(spec);
      let errors = await parsedSpec.validate({
        groups: ['developer']
      });
      expect(errors).not.to.be.undefined;
      expect(errors.length).to.equal(1);
      expect(errors[0].property).to.equal('debug');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors).not.to.be.undefined;
      expect(errors.length).to.equal(1);
      expect(errors[0].property).to.equal('volumes');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('image_store');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('host_path');
      expect(errors[0].constraints).to.include({
        isNotEmpty: 'Debug volumes must include a host path to mount to',
      });
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

      const parsedSpec = new EnvironmentSpecV1(spec);
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

      const parsedSpec = new EnvironmentSpecV1(spec);
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

      const parsedSpec = new EnvironmentSpecV1(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(1);
      expect(errors[0].property).to.equal('parameters');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('PARAM');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('value_from');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('dependency');
      expect(errors[0].constraints).to.include({
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

      const parsedSpec = new EnvironmentSpecV1(spec);
      let errors = await parsedSpec.validate({
        groups: ['operator'],
      });
      expect(errors.length).to.equal(1);
      expect(errors[0].property).to.equal('parameters');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('PARAM');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('value_from');
      expect(errors[0].children.length).to.equal(1);

      errors = errors[0].children;
      expect(errors[0].property).to.equal('datastore');
      expect(errors[0].constraints).to.include({
        isEmpty: 'Datastore values are only accessible to direct consumers'
      });
    });
  });
});
