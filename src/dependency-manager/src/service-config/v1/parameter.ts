import { Default } from '../../utils/transform';
import ServiceParameter from '../parameter';

export default class ServiceParameterV1 extends ServiceParameter {
  description?: string;
  default?: string | number;
  alias?: string;
  @Default(true)
  required = true;

  getAliases(): string[] {
    return this.alias ? [this.alias] : [];
  }

  isRequired() {
    return this.required && !this.default;
  }

  getDescription() {
    return this.description || '';
  }

  getDefaultValue() {
    return this.default;
  }
}
