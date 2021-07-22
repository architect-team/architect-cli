import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require that at least one or more keys specified have values in the object */
export const AtLeastOne = (keys: string[], validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'at_least_one',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [keys],
      options: validationOptions,
      validator: {
        validate(test_object: any, args: ValidationArguments) {
          if (!test_object) { return false; } // if target property is null, no key/value pairs are defined

          const [keys] = args.constraints;
          for (const key of keys) {
            if (test_object[key]) { return true; }
          }

          return false;
        },
      },
    });
  };
};
