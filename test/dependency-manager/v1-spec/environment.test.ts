import { expect } from 'chai';
import { EnvironmentConfigBuilder, EnvironmentVault } from '../../../src/dependency-manager/src';

describe('environment (v1 spec)', () => {
  describe('dns', () => {
    it('should get declared DNS config', async () => {
      const spec = {
        dns: {
          searches: ['thefacebook.com'],
        },
      };

      const parsedSpec = await EnvironmentConfigBuilder.buildFromJSON(spec);
      const dns = parsedSpec.getDnsConfig()!;
      expect(dns).to.have.property('searches');
      expect(dns.searches).to.eql(spec.dns.searches);
    });

    it('should set new DNS config', () => {
      const parsedSpec = EnvironmentConfigBuilder.create();
      parsedSpec.setDnsConfig({
        searches: ['thefacebook.com'],
      });
      const dns = parsedSpec.getDnsConfig()!;
      expect(dns).to.have.property('searches');
      expect(dns.searches).to.eql(['thefacebook.com']);
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

      const parsedSpec = await EnvironmentConfigBuilder.buildFromJSON(spec);
      const vaults = parsedSpec.getVaults();
      expect(Object.keys(vaults).length).to.equal(1);

      const my_vault = vaults['my_vault'];
      expect(my_vault).not.to.be.undefined;
      expect(my_vault!.type).to.equal(spec.vaults.my_vault.type);
      expect(my_vault!.host).to.equal(spec.vaults.my_vault.host);
      expect(my_vault!.description).to.equal(spec.vaults.my_vault.description);
      expect(my_vault!.role_id).to.equal(spec.vaults.my_vault.role_id);
      expect(my_vault!.secret_id).to.equal(spec.vaults.my_vault.secret_id);
      expect(my_vault!.client_token).to.be.undefined;
    });

    it('should set new vault', () => {
      const parsedSpec = EnvironmentConfigBuilder.create();
      let vaults = parsedSpec.getVaults();
      expect(Object.keys(vaults).length).to.equal(0);

      const new_vault = {
        type: 'hashicorp-vault',
        host: '127.0.0.1',
        role_id: 'role',
        secret_id: 'secret',
      } as EnvironmentVault;
      vaults['NEW'] = new_vault;
      parsedSpec.setVaults(vaults);
      vaults = parsedSpec.getVaults();
      expect(Object.keys(vaults).length).to.equal(1);
      expect(vaults).to.have.key('NEW');

      const value = vaults['NEW'];
      expect(value).not.to.be.undefined;
      expect(value).to.eql(new_vault);
    });
  });

  describe('services', () => {
    it('should get services defined as a dictionary', async () => {
      const spec = {
        services: {
          'tests/test': {}
        }
      };

      const parsedSpec = await EnvironmentConfigBuilder.buildFromJSON(spec);
      const services = parsedSpec.getServices();
      expect(Object.keys(services).length).to.equal(1);
      expect(services).to.have.key('tests/test');
    });

    it('should get services defined as dicitonary with nested overrides', async () => {
      const spec = {
        services: {
          'tests/test': {
            command: 'npm run dev'
          }
        }
      };

      const parsedSpec = await EnvironmentConfigBuilder.buildFromJSON(spec);
      const services = parsedSpec.getServices();
      expect(Object.keys(services).length).to.equal(1);
      expect(services).to.have.key('tests/test');

      const service = services['tests/test'];
      expect(service.getCommand()).to.equal(spec.services['tests/test'].command);
    });
  });
});
