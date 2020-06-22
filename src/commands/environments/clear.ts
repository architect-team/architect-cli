import fs from 'fs-extra';
import os from 'os';
import Deploy from '../deploy';

export default class EnvironmentClear extends Deploy {
  static aliases = ['environment:clear', 'env:clear'];
  static description = 'Clear services from an environment';

  static args = [];
  static flags = Deploy.flags;

  async runRemote() {
    const clear_file = `${os.tmpdir()}/env_clear.json`;
    fs.writeJSONSync(clear_file, { services: {} });
    const { flags } = this.parse(EnvironmentClear);
    const flag_options = EnvironmentClear.flags as any;

    const argv_flags: string[] = [];
    for (const [flag, value] of Object.entries(flags)) {
      if (flag_options[flag].exclusive.includes('local')) {
        argv_flags.push(`--${flag}`);
        if (value && typeof value !== 'boolean') {
          argv_flags.push(value.toString());
        }
      }
    }
    super.argv = [clear_file, ...argv_flags];

    await super.runRemote();
  }
}
