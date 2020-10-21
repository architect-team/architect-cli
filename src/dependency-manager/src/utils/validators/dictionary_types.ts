import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require each value of the object is of one of the types specified */
export const DictionaryTypes = (types: string[], validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'dictionary_types',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [types],
      options: validationOptions,
      validator: {
        validate(test_object: any, args: ValidationArguments) {
          const target_object = args.object as any;

          const values = Object.values(target_object[propertyName] || {});
          if (!values.length) return true; // no values to validate

          for (const value of values) {
            if (!args.constraints[0].includes(typeof value)) {
              return false;
            }
          }
          return true;
        },
      },
    });
  };
};
