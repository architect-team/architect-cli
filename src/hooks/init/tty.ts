import { Hook } from '@oclif/core';
import readline from 'readline';
import PromptUtils from '../../common/utils/prompt-utils';

const hook: Hook<'init'> = async function (_) {
  // https://github.com/SBoudrias/Inquirer.js#know-issues
  if (/^win/i.test(process.platform)) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    readline.Interface.prototype.close = () => { };
  }

  if (!PromptUtils.promptsAvailable()) {
    PromptUtils.disablePrompts();
  }
};

export default hook;
