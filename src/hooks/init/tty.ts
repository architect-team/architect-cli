import { Hook } from '@oclif/core';
import readline from 'readline';

const hook: Hook<'init'> = async function (_) {
  // https://github.com/SBoudrias/Inquirer.js#know-issues
  if (/^win/i.test(process.platform)) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    readline.Interface.prototype.close = () => { };
  }
};

export default hook;
