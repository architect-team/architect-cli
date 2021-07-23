import { buildMessage, matches, registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";
import { Dictionary } from '../dictionary';

export const MatchesKeys = (pattern: RegExp, validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'matcheskeys',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [pattern],
      options: validationOptions,
      validator: {
        validate(value: Dictionary<any>, args: ValidationArguments) {
          for (const key of Object.keys(value)) {
            if (!matches(key, args.constraints[0], args.constraints[1])) {
              return false;
            }
          }
          return true;
        },
        defaultMessage: buildMessage(
          (eachPrefix, args) => {
            return 'each key in ' + eachPrefix + '$property must match $constraint1 regular expression';
          },
          validationOptions
        ),
      },
    });
  };
};
