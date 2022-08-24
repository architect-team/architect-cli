import { Flags } from '@oclif/core';

export const booleanString = Flags.build({
  parse: async (input, _) => {
    const boolean_string = input.toLowerCase();
    if (['true', 'false'].includes(boolean_string)) {
      return boolean_string === 'true';
    } else {
      throw new Error(`Invalid value passed to booleanString: ${input}. Must be [true or false].`);
    }
  },
  default: false,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  _type: 'booleanstring', // Used to check if the flag is a booleanstring
});

export const isBooleanStringFlag = (flag: any): boolean => {
  return flag && flag._type === 'booleanstring';
};
