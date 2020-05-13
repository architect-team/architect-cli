import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require that at least one key in the object exists */
export const RequireAtLeastOne = (keys: string[], validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'requireAtLeastOne',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [keys],
      options: validationOptions,
      validator: {
        validate(test_object: any, args: ValidationArguments) {
          const [keys] = args.constraints;
          for (const key of keys) {
            if (key in test_object) {
              return true;
            }
          }
          return false;
        },
      },
    });
  };
};
