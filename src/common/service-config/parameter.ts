import { Default } from '../utils/transform';

export default class ServiceParameterConfig {
  description?: string;
  default?: string | number | null;
  alias?: string;
  required = true;

  isRequired() {
    return this.required && !this.default;
  }
}
