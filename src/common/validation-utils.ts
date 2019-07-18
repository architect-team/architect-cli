export interface StringValidator {
  test(str: string): boolean;
}

export class SemvarValidator implements StringValidator {
  test(str: string) {
    return str.match(
      /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/ig
    ) !== null;
  }
}

export const EnvironmentNameValidator = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?$');
export const ServiceNameValidator = new RegExp('^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\/[a-z0-9]([-a-z0-9]*[a-z0-9])?)?$');
export const EnvNameValidator = new RegExp('^[-._a-zA-Z][-._a-zA-Z0-9]*$');
