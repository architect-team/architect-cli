import { Hook } from '@oclif/config';
import PromptUtils from '../../common/utils/prompt_utils';

const hook: Hook<'init'> = async function (options) {
  if (!PromptUtils.prompts_available()) {
    PromptUtils.disable_prompts();
  }
};

export default hook;
