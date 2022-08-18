import { Flags } from '@oclif/core';

export const booleanString = Flags.build<boolean>({
  parse: async (input, _) => {
    const boolean_string = input.toLowerCase();
    if (['true', 'false'].includes(boolean_string)) {
      return boolean_string === 'true';
    } else {
      throw new Error(`Invalid value passed to booleanString: ${input}. Must be [true or false].`);
    }
  },
  default: false,
});
