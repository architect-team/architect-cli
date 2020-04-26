import { ClassTransformOptions } from 'class-transformer';
import { Equals, IsIn, IsNotEmpty, IsOptional, IsString, ValidatorOptions } from 'class-validator';
import { BaseSpec } from '../base-spec';
import { BaseDnsConfig, BaseEnvironmentConfig, BaseVaultConfig } from '../environment-config';
import { BaseParameterConfig, BaseParameterValueConfig, BaseParameterValueFromConfig, BaseServiceConfig, BaseValueFromDependencyConfig, BaseValueFromVaultConfig } from '../service-config';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary, validateNested } from '../utils/validation';
import { ParameterDefinitionSpecV1, ParameterValueSpecV1, ValueFromDatastoreSpecV1, ValueFromDependencySpecV1, ValueFromVaultSpecV1, ValueFromWrapperSpecV1 } from './parameters';
import { ServiceSpecV1 } from './service';

class DnsSpecV1 extends BaseSpec {
  @IsOptional()
  searches?: string | string[];
}

class VaultSpecV1 extends BaseSpec {
  @IsString()
  @IsIn(['hashicorp-vault'])
  type!: string;

  @IsString()
  host!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  client_token?: string;

  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  secret_id?: string;
}

export class EnvironmentSpecV1 extends BaseEnvironmentConfig {
  @IsOptional()
  @Equals('1')
  __version = '1';

  @IsOptional()
  dns?: DnsSpecV1;

  @IsOptional()
  vaults?: Dictionary<VaultSpecV1>;

  @IsOptional()
  parameters?: Dictionary<ParameterValueSpecV1>;

  @IsNotEmpty()
  services!: ServiceSpecV1[] | Dictionary<string | ServiceSpecV1>;

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (typeof this.dns === 'object') {
      this.dns = new DnsSpecV1(this.dns, options);
    }

    if (typeof this.vaults === 'object') {
      const vaults = {} as Dictionary<VaultSpecV1>;
      Object.entries(this.vaults).forEach(([key, value]) => {
        vaults[key] = new VaultSpecV1(value, options);
      });
      this.vaults = vaults;
    }

    if (typeof this.parameters === 'object') {
      const parameters = {} as Dictionary<ParameterValueSpecV1>;
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          parameters[key] = new ParameterDefinitionSpecV1(value, options);
        } else {
          parameters[key] = value;
        }
      });
      this.parameters = parameters;
    }

    if (Array.isArray(this.services)) {
      this.services = (this.services || []).map(service => new ServiceSpecV1(service, options));
    } else {
      const services = {} as Dictionary<string | ServiceSpecV1>;
      Object.entries(this.services || {}).forEach(([key, value]) => {
        if (typeof value === 'object') {
          services[key] = new ServiceSpecV1(value, options);
        } else {
          services[key] = value;
        }
      });
      this.services = services;
    }
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'dns', errors, options);
    errors = await validateDictionary(this, 'vaults', errors, undefined, options);
    errors = await validateDictionary(this, 'parameters', errors, value => value instanceof ParameterDefinitionSpecV1, options);
    errors = await validateNested(this, 'services', errors, options);
    return errors;
  }

  getDnsConfig(): DnsSpecV1 | undefined {
    return this.dns;
  }

  setDnsConfig(dns?: BaseDnsConfig) {
    if (dns?.searches) {
      this.dns = new DnsSpecV1();
      this.dns.searches = dns.searches;
    } else {
      delete this.dns;
    }
  }

  getVaults(): Map<string, BaseVaultConfig> {
    return new Map(Object.entries(this.vaults || {}));
  }

  setVaults(vaults: Map<string, BaseVaultConfig>) {
    if (vaults.size) {
      const newVaults = {} as Dictionary<VaultSpecV1>;

      vaults.forEach((value, key) => {
        newVaults[key] = new VaultSpecV1();
        newVaults[key].host = value.host;
        newVaults[key].type = value.type;

        if (value.description)
          newVaults[key].description = value.description;

        if (value.client_token)
          newVaults[key].client_token = value.client_token;

        if (value.role_id)
          newVaults[key].role_id = value.role_id;

        if (value.secret_id)
          newVaults[key].secret_id = value.secret_id;
      });

      this.vaults = newVaults;
    } else {
      delete this.vaults;
    }
  }

  getServices(): Array<BaseServiceConfig> {
    if (Array.isArray(this.services)) {
      return new Array(...this.services);
    } else {
      const res = new Array<BaseServiceConfig>();
      Object.entries(this.services).forEach(([key, value]) => {
        if (value instanceof ServiceSpecV1) {
          value.setName(key);
          res.push(value);
        } else {
          const service = new ServiceSpecV1({
            name: key,
            ref: value,
          });
          res.push(service);
        }
      });
      return res;
    }
  }

  setServices(services: Array<BaseServiceConfig>) {
    this.services = services.map(service => {
      const operator_service = new ServiceSpecV1();
      operator_service.merge(service);
      return operator_service;
    });
  }

  getParameters(): Map<string, BaseParameterConfig> {
    const res = new Map<string, BaseParameterConfig>();

    // Map a string/number param value to the `value` field
    Object.entries(this.parameters || {}).forEach(([key, value]) => {
      if (!(value instanceof ParameterDefinitionSpecV1)) {
        res.set(key, { default: value });
      } else {
        let value_from = value.value_from || value.valueFrom;
        if (value.default instanceof ValueFromWrapperSpecV1) {
          value_from = value_from || value.default.value_from || value.default.valueFrom;
        }

        // Transform a datastore to a dependency reference
        if (value_from && value_from instanceof ValueFromDatastoreSpecV1) {
          throw new Error('Datastores can only be referenced by the services that claim them');
        } else if (value_from) {
          res.set(key, { value_from });
        } else {
          const item = {} as BaseParameterValueConfig;
          if (typeof value.default === 'string' || typeof value.default === 'number') {
            item.default = value.default;
          }
          res.set(key, item);
        }
      }
    });

    return res;
  }

  setParameters(parameters: Map<string, BaseParameterConfig>) {
    const newParameters = {} as Dictionary<ParameterValueSpecV1>;

    parameters.forEach((value, key) => {
      const param = new ParameterDefinitionSpecV1();
      if (value.hasOwnProperty('default')) {
        value = value as BaseParameterValueConfig;
        param.default = value.default;
      } else {
        value = value as BaseParameterValueFromConfig;
        if (value.value_from.hasOwnProperty('vault')) {
          param.value_from = new ValueFromVaultSpecV1();
          const value_from = value.value_from as BaseValueFromVaultConfig;
          param.value_from.vault = value_from.vault;
          param.value_from.key = value_from.key;
        } else {
          param.value_from = new ValueFromDependencySpecV1();
          const value_from = value.value_from as BaseValueFromDependencyConfig;
          param.value_from.dependency = value_from.dependency;
          param.value_from.value = value_from.value;
        }
      }

      newParameters[key] = param;
    });

    this.parameters = newParameters;
  }
}
