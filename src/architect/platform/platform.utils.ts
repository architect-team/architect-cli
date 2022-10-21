import { Flags } from '@oclif/core';

export default class PlatformUtils {
  static flags = {
    platform: Flags.string({
      description: 'Architect cluster',
      env: 'ARCHITECT_PLATFORM',
      parse: async value => value.toLowerCase(),
      sensitive: false,
      exclusive: ['cluster'],
    }),
  };
}
