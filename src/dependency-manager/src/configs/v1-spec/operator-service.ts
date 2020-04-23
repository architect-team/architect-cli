import { IsBoolean, IsInstance, IsOptional, IsString, ValidateIf } from 'class-validator';
import { BaseParameterConfig, BaseParameterValueConfig, BaseParameterValueFromConfig, BaseServiceConfig, BaseValueFromDependencyConfig, BaseValueFromVaultConfig } from '../base-configs/service-config';
import { BaseSpec } from '../base-spec';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary, validateNested } from '../utils/validation';
import { SharedDebugSpecV1 } from './shared/debug';
import { ValueFromDependencySpecV1 } from './shared/parameters';
import { SharedServiceSpecV1 } from './shared/service';

class OperatorDebugVolumeSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  mount_path?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  readonly?: boolean;

  @IsString()
  host_path!: string;
}

class OperatorServiceDebugSpec extends SharedDebugSpecV1 {
  @IsOptional()
  volumes?: Dictionary<OperatorDebugVolumeSpecV1>;

  constructor(plain: any) {
    super(plain);

    if (typeof this.volumes === 'object') {
      Object.entries(this.volumes).forEach(([key, value]) => {
        this.volumes![key] = new OperatorDebugVolumeSpecV1(value);
      });
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'volumes', errors);
    return errors;
  }
}

export class OperatorValueFromVaultParameterSpecV1 extends BaseSpec {
  @IsString()
  vault!: string;

  @IsString()
  key!: string;
}

export class OperatorValueFromWrapperSpecV1 extends BaseSpec {
  @IsOptional()
  value_from?: ValueFromDependencySpecV1 | OperatorValueFromVaultParameterSpecV1;

  @ValidateIf(obj => !obj.value_from)
  valueFrom?: ValueFromDependencySpecV1 | OperatorValueFromVaultParameterSpecV1;

  constructor(plain?: any) {
    super(plain);

    if (this.value_from && this.value_from.hasOwnProperty('vault')) {
      this.value_from = new OperatorValueFromVaultParameterSpecV1(this.value_from);
    } else if (this.value_from) {
      this.value_from = new ValueFromDependencySpecV1(this.value_from);
    }

    if (this.valueFrom && this.valueFrom.hasOwnProperty('vault')) {
      this.valueFrom = new OperatorValueFromVaultParameterSpecV1(this.valueFrom);
    } else if (this.valueFrom) {
      this.valueFrom = new ValueFromDependencySpecV1(this.valueFrom);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'value_from', errors);
    errors = await validateNested(this, 'valueFrom', errors);
    return errors;
  }
}

export class OperatorParameterValueSpecV1 extends OperatorValueFromWrapperSpecV1 {
  @ValidateIf(obj => !obj.valueFrom && !obj.value_from)
  default?: string | number | OperatorValueFromWrapperSpecV1;

  constructor(plain?: any) {
    super(plain);

    if (typeof this.default === 'object') {
      this.default = new OperatorValueFromWrapperSpecV1(this.default);
    }
  }

  async validate() {
    let errors = await super.validate();
    if (this.default instanceof OperatorValueFromWrapperSpecV1) {
      errors = await validateNested(this, 'default', errors);
    }
    return errors;
  }
}

export type OperatorParameterSpecV1 = string | number | OperatorParameterValueSpecV1;

export class OperatorServiceSpecV1 extends SharedServiceSpecV1 {
  @IsOptional()
  parameters?: Dictionary<OperatorParameterSpecV1>;

  @IsOptional()
  dependencies?: Dictionary<string | OperatorServiceSpecV1>;

  @IsOptional()
  @IsInstance(OperatorServiceDebugSpec)
  debug?: OperatorServiceDebugSpec;

  constructor(plain?: any) {
    super(plain);

    if (typeof this.parameters === 'object') {
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.parameters![key] = new OperatorParameterValueSpecV1(value);
        }
      });
    }

    if (typeof this.dependencies === 'object') {
      Object.entries(this.dependencies).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.dependencies![key] = new OperatorServiceSpecV1(value);
        }
      });
    }

    if (typeof this.debug === 'object') {
      this.debug = new OperatorServiceDebugSpec(this.debug);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'parameters', errors, value => value instanceof OperatorParameterValueSpecV1);
    errors = await validateDictionary(this, 'dependencies', errors, value => value instanceof OperatorServiceSpecV1);
    errors = await validateNested(this, 'debug', errors);
    return errors;
  }

  copy() {
    const res = new OperatorServiceSpecV1();
    res.merge(this);
    return res;
  }

  getParameters() {
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

  getDependencies(): Array<BaseServiceConfig> {
    const res = new Array<BaseServiceConfig>();

    if (this.dependencies) {
      Object.entries(this.dependencies).forEach(([dep_name, value]) => {
        if (typeof value === 'string') {
          const newDep = new OperatorServiceSpecV1();
          newDep.name = dep_name;
          newDep.ref = value;
          res.push(newDep);
        } else {
          value.setName(dep_name);
          res.push(value);
        }
      });
    }

    return res;
  }

  setDependencies(dependencies: Array<BaseServiceConfig>) {
    const newDeps = {} as Dictionary<string | OperatorServiceSpecV1>;
    dependencies.forEach(value => {
      newDeps[value.getName()] = OperatorServiceSpecV1.copy(value);
    });
    this.dependencies = newDeps;
  }
}
