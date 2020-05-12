import { registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";

export function ExclusiveKeys(keys: string[], validationOptions?: ValidationOptions) { // TODO: clean up, also create RequireOne
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'exclusiveKeys',
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
          return true; // you can return a Promise<boolean> here as well, if you want to make async validation
        }
      }
    });
  };
}
