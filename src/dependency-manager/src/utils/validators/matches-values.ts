import { buildMessage, matches, registerDecorator, ValidationArguments, ValidationOptions } from "class-validator";
import { Dictionary } from '../dictionary';

export const MatchesValues = (pattern: RegExp, validationOptions?: ValidationOptions) => {
  return (object: Record<string, any>, propertyName: string) => {
    registerDecorator({
      name: 'matchesvalues',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [pattern],
      options: validationOptions,
      validator: {
        validate(value: Dictionary<any>, args: ValidationArguments) {
          for (const v of Object.values(value)) {
            if (!matches(v, args.constraints[0], args.constraints[1])) {
              return false;
            }
          }
          return true;
        },
        defaultMessage: buildMessage(
          (eachPrefix, args) => {
            return 'each value in ' + eachPrefix + '$property must match $constraint1 regular expression';
          },
          validationOptions
        ),
      },
    });
  };
};
