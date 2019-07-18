export default class ServiceEnv {
  description?: string;
  default?: string | number | null;
  required = true;

  constructor(partial: Partial<ServiceEnv>) {
    Object.assign(this, partial);
  }
}
