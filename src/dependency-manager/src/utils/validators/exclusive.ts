import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require that these keys do not exist in the object */
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
          const target_object = args.object as any;

          if (!target_object[propertyName]) { return true; } // if target property doesn't exist, exclusivity always true

          const [excluded_keys] = args.constraints;
          for (const key of excluded_keys) {
            if (target_object[key]) {
              return false;
            }
          }
          return true;
        },
      },
    });
  };
};
