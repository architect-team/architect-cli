export default class ServiceEnv {
  key?: string;
  name?: string;
  description?: string;
  default?: string | number | null;
  required = true;

  constructor(partial: Partial<ServiceEnv>) {
    Object.assign(this, partial);
  }
}
