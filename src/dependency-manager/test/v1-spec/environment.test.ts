import { expect } from 'chai';
import { BaseParameterValueConfig, BaseParameterValueFromConfig, BaseValueFromVaultConfig } from '../../src/configs/base-configs/service-config';
import { EnvironmentSpecV1 } from '../../src/configs/v1-spec/environment';

describe('environment (v1 spec)', () => {
  describe('dns', () => {
    it('should get declared DNS config', async () => {
      const spec = {
        dns: {
          searches: ['thefacebook.com'],
        },
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      await parsedSpec.validateOrReject();
      const dns = parsedSpec.getDnsConfig();
      expect(dns).to.have.property('searches');
      expect(dns.searches).to.eql(spec.dns.searches);
    });

    it('should set new DNS config', () => {
      const parsedSpec = new EnvironmentSpecV1();
      parsedSpec.setDnsConfig({
        searches: ['thefacebook.com'],
      });
      const dns = parsedSpec.getDnsConfig();
      expect(dns).to.have.property('searches');
      expect(dns.searches).to.eql(['thefacebook.com']);
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
      const parsedSpec = new EnvironmentSpecV1(spec);
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
      const config = new EnvironmentSpecV1();
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
      const config = new EnvironmentSpecV1();
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

  describe('vaults', () => {
    it('should get defined vaults', async () => {
      const spec = {
        vaults: {
          my_vault: {
            type: 'hashicorp-vault',
            host: '127.0.0.1',
            description: 'My first vault',
            role_id: 'role',
            secret_id: 'secret',
          }
        },
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      await parsedSpec.validateOrReject();
      const vaults = parsedSpec.getVaults();
      expect(vaults.size).to.equal(1);

      const my_vault = vaults.get('my_vault');
      expect(my_vault).not.to.be.undefined;
      expect(my_vault!.type).to.equal(spec.vaults.my_vault.type);
      expect(my_vault!.host).to.equal(spec.vaults.my_vault.host);
      expect(my_vault!.description).to.equal(spec.vaults.my_vault.description);
      expect(my_vault!.role_id).to.equal(spec.vaults.my_vault.role_id);
      expect(my_vault!.secret_id).to.equal(spec.vaults.my_vault.secret_id);
      expect(my_vault!.client_token).to.be.undefined;
    });
  });
});
