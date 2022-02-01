import { Hook } from '@oclif/core';
import readline from 'readline';
import PromptUtils from '../../common/utils/prompt-utils';

const hook: Hook<'init'> = async function (options) {
  // https://github.com/SBoudrias/Inquirer.js#know-issues
  if (/^win/i.test(process.platform)) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    readline.Interface.prototype.close = () => { };
  }
  if (!PromptUtils.prompts_available()) {
    PromptUtils.disable_prompts();
  }
};

export default hook;
