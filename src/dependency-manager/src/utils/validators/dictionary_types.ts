import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

/** Require that these keys do not exist in the object */
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
