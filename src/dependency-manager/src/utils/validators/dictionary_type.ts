import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require each value of the object is of the type specified */
export const DictionaryType = (type: string, validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'dictionary_type',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [type],
      options: validationOptions,
      validator: {
        validate(test_object: any, args: ValidationArguments) {
          const target_object = args.object as any;

          const values = Object.values(target_object[propertyName] || {});
          if (!values.length) return true; // no values to validate

          for (const value of values) {
            if (typeof value !== args.constraints[0]) {
              return false;
            }
          }
          return true;
        },
      },
    });
  };
};
