export default class StringTemplateBuilder {
  private _func: Function;
  private _param_values: any;
  protected _params: string[];

  constructor(params: string[], func: Function, param_values?: object) {
    this._func = func;
    this._params = params;
    this._param_values = {};
    if (param_values) {
      this._set(param_values);
    }
  }

  get params(): string[] {
    return this._params;
  }

  private _set(param_values: object) {
    Object.entries(param_values).forEach(([key, value]) => {
      if (!this.params.includes(key)) {
        throw new Error(`Unexpected url parameter: ${key}. Expected properties are: ${this.params}`);
      }
      this._param_values[key] = value;
    });
  }

  private newInstance(param_values: object): StringTemplateBuilder {
    return new StringTemplateBuilder(this.params, this._func, { ...this._param_values, ...param_values });
  }

  public with(param_values: object): StringTemplateBuilder {
    return this.newInstance(param_values);
  }

  protected run(): string {
    const missing = this.params.filter(p => this._param_values[p] === undefined);
    if (missing.length !== 0) {
      throw new Error(`Missing template parameters: ${missing}`);
    }
    return this._func(this._param_values);
  }

  public build(param_values?: object): string {
    const inst = param_values
      ? this.newInstance(param_values)
      : this;
    return inst.run();
  }
}