import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require that only one of the keys exists in the object */
export const Exclusive = (keys: string[], validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'exclusive',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [keys],
      options: validationOptions,
      validator: {
        validate(test_object: any, args: ValidationArguments) {
          const [keys] = args.constraints;
          let keys_found = false;
          for (const key of keys) {
            if (key in test_object) {
              if (keys_found === true) { return false; }
              keys_found = true;
            }
          }
          return true;
        },
      },
    });
  };
};
