import { IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseParameterConfig, BaseParameterValueConfig, BaseParameterValueFromConfig, BaseServiceConfig, BaseValueFromDependencyConfig } from '../base-configs/service-config';
import { BaseSpec } from '../base-spec';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary, validateNested } from '../utils/validation';
import { SharedDebugSpecV1 } from './shared/debug';
import { ParameterDefinitionSpecV1, ParameterValueFromWrapperV1, ParameterValueSpecV1, ValueFromDatastoreSpecV1, ValueFromDependencySpecV1 } from './shared/parameters';
import { SharedServiceSpecV1 } from './shared/service';
import { VolumeClaimSpecV1 } from './shared/volume-claim';

class VolumeSpecV1 extends VolumeClaimSpecV1 {
  @IsString()
  host_path!: string;
}

class ServiceDebugSpecV1 extends SharedDebugSpecV1 {
  @IsOptional()
  volumes?: Dictionary<VolumeSpecV1>;

  constructor(plain?: any) {
    super(plain);

    if (this.volumes) {
      Object.entries(this.volumes).forEach(([key, value]) => {
        this.volumes![key] = new VolumeSpecV1(value);
      });
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'volumes', errors);
    return errors;
  }
}

class DatastoreClaimSpecV1 extends BaseSpec {
  @IsString()
  image!: string;

  @IsNumber()
  port!: number;

  @IsOptional()
  parameters?: Dictionary<ParameterValueSpecV1>;

  constructor(plain?: any) {
    super(plain);

    if (typeof this.parameters === 'object') {
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.parameters![key] = new ParameterDefinitionSpecV1(value);
        }
      });
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'parameters', errors);
    return errors;
  }

  toServiceSpec(service_name: string, datastore_key: string) {
    const newDep = new ServiceSpecV1();
    newDep.name = `${service_name}.${datastore_key}`;
    newDep.image = this.image;
    newDep.port = this.port;
    if (this.parameters) {
      newDep.parameters = this.parameters;
    }

    return newDep;
  }
}

export class ServiceSpecV1 extends SharedServiceSpecV1 {
  @IsOptional()
  parameters?: Dictionary<ParameterValueSpecV1>;

  @IsOptional()
  dependencies?: Dictionary<string | ServiceSpecV1>;

  @IsOptional()
  debug?: ServiceDebugSpecV1;

  @IsOptional()
  datastores?: Dictionary<DatastoreClaimSpecV1>;

  // ------------------------------------------------------
  //  START GETTERS/SETTERS
  // ------------------------------------------------------

  constructor(plain?: any) {
    super(plain);

    if (typeof this.parameters === 'object') {
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.parameters![key] = new ParameterDefinitionSpecV1(value);
        }
      });
    }

    if (typeof this.dependencies === 'object') {
      Object.entries(this.dependencies).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.dependencies![key] = new ServiceSpecV1(value);
        }
      });
    }

    if (typeof this.debug === 'object') {
      this.debug = new ServiceDebugSpecV1(this.debug);
    }

    if (typeof this.datastores === 'object') {
      Object.entries(this.datastores).forEach(([key, value]) => {
        this.datastores![key] = new DatastoreClaimSpecV1(value);
      });
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'parameters', errors, value => value instanceof ParameterDefinitionSpecV1);
    errors = await validateDictionary(this, 'dependencies', errors, value => value instanceof ServiceSpecV1);
    errors = await validateNested(this, 'debug', errors);
    errors = await validateDictionary(this, 'datastores', errors);
    return errors;
  }

  copy() {
    const res = new ServiceSpecV1();
    res.merge(this);
    return res;
  }

  getParameters() {
    const res = new Map<string, BaseParameterConfig>();

    // Map a string/number param value to the `value` field
    Object.entries(this.parameters || {}).forEach(([key, value]) => {
      if (!(value instanceof ParameterDefinitionSpecV1)) {
        res.set(key, { default: value });
      } else {
        let value_from = value.value_from || value.valueFrom;
        if (value.default instanceof ParameterValueFromWrapperV1) {
          value_from = value_from || value.default.value_from || value.default.valueFrom;
        }

        if (value_from && value_from instanceof ValueFromDatastoreSpecV1) {
          res.set(key, {
            value_from: {
              dependency: `${this.name}.${value_from.datastore}`,
              value: value_from.value,
            },
          });
        } else if (value_from) {
          res.set(key, { value_from });
        } else {
          const item = {} as BaseParameterValueConfig;
          if (value.description) {
            item.description = value.description;
          }

          if (value.required) {
            item.required = value.required;
          }

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
        param.required = value.required;
        param.description = value.description;
      } else {
        value = value as BaseParameterValueFromConfig;
        if (value.value_from.hasOwnProperty('vault')) {
          throw new Error('Services cannot hardcode values from vaults');
        }
        param.value_from = new ValueFromDependencySpecV1();
        const value_from = value.value_from as BaseValueFromDependencyConfig;
        param.value_from.dependency = value_from.dependency;
        param.value_from.value = value_from.value;
      }

      newParameters[key] = param;
    });

    this.parameters = newParameters;
  }

  getDependencies(): Array<BaseServiceConfig> {
    let res = new Array<BaseServiceConfig>();

    if (this.dependencies) {
      Object.entries(this.dependencies).forEach(([dep_name, value]) => {
        if (typeof value === 'string') {
          const newDep = new ServiceSpecV1();
          newDep.name = dep_name;
          newDep.ref = value;
          res.push(newDep);
        } else {
          value.setName(dep_name);
          res.push(value);
        }
      });
    }

    if (this.datastores) {
      Object.entries(this.datastores).forEach(([key, value]) => {
        res.push(value.toServiceSpec(this.name || '', key));
      });
    }

    return res;
  }

  setDependencies(dependencies: Array<BaseServiceConfig>) {
    const newDeps = {} as Dictionary<string | ServiceSpecV1>;
    dependencies.forEach(value => {
      newDeps[value.getName()] = ServiceSpecV1.copy(value);
    });
    this.dependencies = newDeps;
  }
}