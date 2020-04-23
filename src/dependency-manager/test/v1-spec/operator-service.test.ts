import { expect } from 'chai';
import { BaseParameterValueConfig, BaseParameterValueFromConfig, BaseServiceConfig, BaseValueFromVaultConfig } from '../../src/configs/base-configs/service-config';
import { OperatorServiceSpecV1 } from '../../src/configs/v1-spec/operator-service';

describe('operator service (v1 spec)', () => {
  describe('name', () => {
    it('should get defined name', async () => {
      const spec = {
        name: 'tests/test'
      };
      const parsedSpec = new OperatorServiceSpecV1(spec);
      await parsedSpec.validateOrReject();
      expect(parsedSpec.getName()).to.equal(spec.name);
    });

    it('should set new name', async () => {
      const spec = {
        name: 'tests/test'
      };
      const parsedSpec = new OperatorServiceSpecV1(spec);
      await parsedSpec.validateOrReject();
      parsedSpec.setName('tests/new');
      expect(parsedSpec.getName()).to.equal('tests/new');
    });
  });

  describe('parameters', () => {
    it('should get defined parameters', async () => {
      const spec = {
        parameters: {
          SIMPLE: 'value',
          NESTED: {
            default: 'nested'
          },
          VAULT: {
            value_from: {
              vault: 'my-vault',
              key: 'folder/secret#key'
            },
          },
        },
      };
      const parsedSpec = new OperatorServiceSpecV1(spec);
      await parsedSpec.validateOrReject();

      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(3);
      parameters.forEach((value, key) => {
        switch (key) {
          case 'SIMPLE':
            expect(value).to.have.property('default');
            value = value as BaseParameterValueConfig;
            expect(value.default).to.equal(spec.parameters.SIMPLE);
            break;
          case 'NESTED':
            expect(value).to.have.property('default');
            value = value as BaseParameterValueConfig;
            expect(value.default).to.equal(spec.parameters.NESTED.default);
            break;
          case 'VAULT':
            expect(value).to.have.property('value_from');
            value = value as BaseParameterValueFromConfig;
            expect(value.value_from).to.have.property('vault');
            expect(value.value_from).to.have.property('key');
            value.value_from = value.value_from as BaseValueFromVaultConfig;
            expect(value.value_from.vault).to.equal(spec.parameters.VAULT.value_from.vault);
            expect(value.value_from.key).to.equal(spec.parameters.VAULT.value_from.key);
            break;
          default:
            throw new Error('Unexpected validation error');
        }
      });
    });

    it('should set new simple parameters', async () => {
      const config = new OperatorServiceSpecV1();
      let parameters = config.getParameters();
      parameters.set('TEST', {
        description: 'Some description',
        default: 'value',
      });
      config.setParameters(parameters);
      parameters = config.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('TEST');

      let test = parameters.get('TEST');
      expect(test).not.to.be.undefined;
      test = test as BaseParameterValueConfig;
      expect(test.default).to.equal('value');
    });

    it('should set new complex parameters', async () => {
      const config = new OperatorServiceSpecV1();
      let parameters = config.getParameters();
      parameters.set('TEST', {
        value_from: {
          vault: 'my-vault',
          key: 'folder/secret#key',
        },
      });
      config.setParameters(parameters);
      parameters = config.getParameters();
      expect(parameters.size).to.equal(1);
      expect(parameters).to.have.key('TEST');

      let test = parameters.get('TEST');
      expect(test).not.to.be.undefined;
      test = test as BaseParameterValueFromConfig;
      expect(test.value_from).to.have.property('vault');
      expect(test.value_from).to.have.property('key');
      test.value_from = test.value_from as BaseValueFromVaultConfig;
      expect(test.value_from.key).to.equal('folder/secret#key');
      expect(test.value_from.vault).to.equal('my-vault');
    });
  });

  describe('dependencies', () => {
    it('should get declared dependencies', async () => {
      const spec = {
        dependencies: {
          'tests/dep': 'latest',
          'tests/nested': {
            ref: 'v1',
            parameters: {
              PARAM: 'value'
            },
          },
        },
      };
      const parsedSpec = new OperatorServiceSpecV1(spec);
      await parsedSpec.validateOrReject();
      const dependencies = parsedSpec.getDependencies();
      expect(dependencies.length).to.equal(2);

      for (const dep of dependencies) {
        switch (dep.getName()) {
          case 'tests/dep':
            expect(dep.getRef()).to.equal('latest');
            break;
          case 'tests/nested':
            expect(dep.getRef()).to.equal('v1');
            const parameters = dep.getParameters();
            expect(parameters.size).to.equal(1);

            let param = parameters.get('PARAM');
            expect(param).not.to.be.undefined;
            expect(param).to.have.property('default');

            param = param as BaseParameterValueConfig;
            expect(param.default).to.equal(spec.dependencies['tests/nested'].parameters.PARAM);
            break;
          default:
            throw new Error('Unexpected validation error');
        }
      }
    });

    it('should set simple dependencies', () => {
      const parsedSpec = new OperatorServiceSpecV1();
      let dependencies = parsedSpec.getDependencies();

      const newService = new OperatorServiceSpecV1();
      newService.setName('tests/dep');
      newService.setRef('latest');
      dependencies.push(newService);
      parsedSpec.setDependencies(dependencies);
      dependencies = parsedSpec.getDependencies();
      expect(dependencies.length).to.equal(1);
      expect(dependencies[0].getRef()).to.equal('latest');
      expect(dependencies[0].getName()).to.equal('tests/dep');
    });

    it('should set nested dependencies', () => {
      const parsedSpec = new OperatorServiceSpecV1();
      let dependencies = parsedSpec.getDependencies();
      const nested = new OperatorServiceSpecV1({
        name: 'tests/dep',
        ref: 'latest',
        dependencies: {
          'nested/dep': 'latest',
        },
      });

      dependencies.push(nested);
      parsedSpec.setDependencies(dependencies);
      dependencies = parsedSpec.getDependencies();
      expect(dependencies.length).to.equal(1);

      let dep = dependencies[0];
      expect(dep).not.to.be.undefined;
      dep = dep as BaseServiceConfig;

      const nested_dependencies = dep.getDependencies();
      expect(nested_dependencies.length).to.equal(1);
      expect(nested_dependencies[0].getRef()).to.equal('latest');
    });
  });
});
