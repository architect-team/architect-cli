export default class ServiceParameter {
  description?: string;
  default?: string | number | null;
  required = true;

  constructor(partial: Partial<ServiceParameter>) {
    Object.assign(this, partial);
  }
}
