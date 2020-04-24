import { IsArray, IsEnum, IsInstance, IsOptional, IsString } from 'class-validator';
import { BaseDnsConfig, BaseEnvironmentConfig, BaseVaultConfig } from '../base-configs/environment-config';
import { BaseParameterConfig, BaseParameterValueConfig, BaseParameterValueFromConfig, BaseServiceConfig, BaseValueFromDependencyConfig, BaseValueFromVaultConfig } from '../base-configs/service-config';
import { BaseSpec } from '../base-spec';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary, validateNested } from '../utils/validation';
import { OperatorParameterSpecV1, OperatorParameterValueSpecV1, OperatorServiceSpecV1, OperatorValueFromVaultParameterSpecV1, OperatorValueFromWrapperSpecV1 } from './operator-service';
import { ValueFromDependencySpecV1 } from './shared/parameters';

class DnsSpecV1 extends BaseSpec {
  @IsOptional()
  searches?: string | string[];
}

class VaultSpecV1 extends BaseSpec {
  @IsString()
  @IsEnum(['hashicorp-vault'])
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
  @IsString()
  __version = '1';

  @IsOptional()
  dns?: DnsSpecV1;

  @IsOptional()
  vaults?: Dictionary<VaultSpecV1>;

  @IsOptional()
  parameters?: Dictionary<OperatorParameterSpecV1>;

  @IsArray()
  @IsInstance(OperatorServiceSpecV1, { each: true })
  services!: OperatorServiceSpecV1[];

  constructor(plain?: any) {
    super(plain);

    if (typeof this.dns === 'object') {
      this.dns = new DnsSpecV1(this.dns);
    }

    if (typeof this.vaults === 'object') {
      Object.entries(this.vaults).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.vaults![key] = new VaultSpecV1(value);
        }
      });
    }

    if (typeof this.parameters === 'object') {
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.parameters![key] = new OperatorParameterValueSpecV1(value);
        }
      });
    }

    this.services = (this.services || []).map(service => new OperatorServiceSpecV1(service));
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'dns', errors);
    errors = await validateDictionary(this, 'vaults', errors);
    errors = await validateNested(this, 'services', errors);
    return errors;
  }

  copy() {
    const res = new EnvironmentSpecV1();
    res.merge(this);
    return res;
  }

  getDnsConfig(): DnsSpecV1 {
    return this.dns || new DnsSpecV1();
  }

  setDnsConfig(dns: BaseDnsConfig) {
    if (dns.searches) {
      this.dns = new DnsSpecV1();
      this.dns.searches = dns.searches;
    } else {
      delete this.dns;
    }
  }

  getVaults() {
    return new Map(Object.entries(this.vaults || {}));
  }

  setVaults(vaults: Map<string, BaseVaultConfig>) {
    if (vaults.size) {
      const newVaults = {} as Dictionary<VaultSpecV1>;

      vaults.forEach((value, key) => {
        newVaults[key] = new VaultSpecV1();
        newVaults[key].host = value.host;
        newVaults[key].type = value.type;

        if (value.description) {
          newVaults[key].description = value.description;
        }

        if (value.client_token) {
          newVaults[key].client_token = value.client_token;
        }

        if (value.role_id) {
          newVaults[key].role_id = value.role_id;
        }

        if (value.secret_id) {
          newVaults[key].secret_id = value.secret_id;
        }
      });

      this.vaults = newVaults;
    } else {
      delete this.vaults;
    }
  }

  getServices() {
    return new Array(...this.services);
  }

  setServices(services: Array<BaseServiceConfig>) {
    this.services = services.map(service => {
      const operator_service = new OperatorServiceSpecV1();
      operator_service.merge(service);
      return operator_service;
    });
  }

  getParameters(): Map<string, BaseParameterConfig> {
    const res = new Map<string, BaseParameterConfig>();

    // Map a string/number param value to the `value` field
    Object.entries(this.parameters || {}).forEach(([key, value]) => {
      if (!(value instanceof OperatorParameterValueSpecV1)) {
        res.set(key, { default: value });
      } else {
        let value_from = value.value_from || value.valueFrom;
        if (value.default instanceof OperatorValueFromWrapperSpecV1) {
          value_from = value_from || value.default.value_from || value.default.valueFrom;
        }

        if (value_from) {
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
    const newParameters = {} as Dictionary<OperatorParameterSpecV1>;

    parameters.forEach((value, key) => {
      const param = new OperatorParameterValueSpecV1();
      if (value.hasOwnProperty('default')) {
        value = value as BaseParameterValueConfig;
        param.default = value.default;
      } else {
        value = value as BaseParameterValueFromConfig;
        if (value.value_from.hasOwnProperty('vault')) {
          param.value_from = new OperatorValueFromVaultParameterSpecV1();
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
