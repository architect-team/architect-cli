import { expect } from 'chai';
import { BaseVaultConfig } from '../../src/configs/environment-config';
import { BaseParameterValueConfig, BaseParameterValueFromConfig, BaseValueFromVaultConfig } from '../../src/configs/service-config';
import { EnvironmentSpecV1 } from '../../src/configs/v1-spec/environment';

describe('environment (v1 spec)', () => {
  describe('dns', () => {
    it('should get declared DNS config', () => {
      const spec = {
        dns: {
          searches: ['thefacebook.com'],
        },
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      const dns = parsedSpec.getDnsConfig()!;
      expect(dns).to.have.property('searches');
      expect(dns.searches).to.eql(spec.dns.searches);
    });

    it('should set new DNS config', () => {
      const parsedSpec = new EnvironmentSpecV1();
      parsedSpec.setDnsConfig({
        searches: ['thefacebook.com'],
      });
      const dns = parsedSpec.getDnsConfig()!;
      expect(dns).to.have.property('searches');
      expect(dns.searches).to.eql(['thefacebook.com']);
    });
  });

  describe('parameters', () => {
    it('should get simple parameters', () => {
      const spec = {
        parameters: {
          SIMPLE: 'value'
        },
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);

      const param = parameters.get('SIMPLE') as BaseParameterValueConfig;
      expect(param.default).to.equal(spec.parameters.SIMPLE);
    });

    it('should get nested parameters', () => {
      const spec = {
        parameters: {
          NESTED: {
            default: 'value',
          }
        },
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);

      const param = parameters.get('NESTED') as BaseParameterValueConfig;
      expect(param.default).to.equal(spec.parameters.NESTED.default);
    });

    it('should get value_from parameters', () => {
      const spec = {
        parameters: {
          VAULT: {
            value_from: {
              vault: 'my-vault',
              key: 'folder/secret#key'
            },
          },
        },
      };
      const parsedSpec = new EnvironmentSpecV1(spec);
      const parameters = parsedSpec.getParameters();
      expect(parameters.size).to.equal(1);

      const param = parameters.get('VAULT') as BaseParameterValueFromConfig;
      expect(param).not.to.be.undefined;
      expect(param.value_from).to.have.property('vault');
      expect(param.value_from).to.have.property('key');
      param.value_from = param.value_from as BaseValueFromVaultConfig;
      expect(param.value_from.vault).to.equal(spec.parameters.VAULT.value_from.vault);
      expect(param.value_from.key).to.equal(spec.parameters.VAULT.value_from.key);
    });

    it('should set new simple parameters', () => {
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

    it('should set new complex parameters', () => {
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
    it('should get defined vaults', () => {
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

    it('should set new vault', () => {
      const parsedSpec = new EnvironmentSpecV1();
      let vaults = parsedSpec.getVaults();
      expect(vaults.size).to.equal(0);

      const new_vault = {
        type: 'hashicorp-vault',
        host: '127.0.0.1',
        role_id: 'role',
        secret_id: 'secret',
      } as BaseVaultConfig;
      vaults.set('NEW', new_vault);
      parsedSpec.setVaults(vaults);
      vaults = parsedSpec.getVaults();
      expect(vaults.size).to.equal(1);
      expect(vaults).to.have.key('NEW');

      const value = vaults.get('NEW');
      expect(value).not.to.be.undefined;
      expect(value).to.eql(new_vault);
    });
  });

  describe('services', () => {
    it('should get services defined as an array', async () => {
      const spec = {
        services: [
          {
            name: 'tests/test',
            ref: 'latest'
          }
        ]
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      const services = parsedSpec.getServices();
      expect(services.length).to.equal(1);

      expect(services[0].getName()).to.equal(spec.services[0].name);
      expect(services[0].getRef()).to.equal(spec.services[0].ref);
    });

    it('should get services defined as a dictionary', async () => {
      const spec = {
        services: {
          'tests/test': 'latest'
        }
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      const services = parsedSpec.getServices();
      expect(services.length).to.equal(1);

      expect(services[0].getName()).to.equal('tests/test');
      expect(services[0].getRef()).to.equal(spec.services['tests/test']);
    });

    it('should get services defined as dicitonary with nested overrides', async () => {
      const spec = {
        services: {
          'tests/test': {
            ref: 'latest',
            command: 'npm run dev'
          }
        }
      };

      const parsedSpec = new EnvironmentSpecV1(spec);
      const services = parsedSpec.getServices();
      expect(services.length).to.equal(1);

      expect(services[0].getName()).to.equal('tests/test');
      expect(services[0].getRef()).to.equal(spec.services['tests/test'].ref);
      expect(services[0].getCommand()).to.equal(spec.services['tests/test'].command);
    });
  });
});
