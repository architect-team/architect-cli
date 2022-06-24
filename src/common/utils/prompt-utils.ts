import isCi from 'is-ci';

export default class PromptUtils {

  /**
   * Removes all/any applied ascii color codes from a string, and returns the modified string or empty string.
   * @param {string} message - a string to modify
   *
   */
  public static strip_ascii_color_codes_from_string(message?: string): string {
    if (!message) {
      return '';
    }
    // https://github.com/chalk/ansi-regex/blob/main/index.js#L3
    const pattern = [
      '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
      '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
    ].join('|');

    return message.replace(new RegExp(pattern, 'g'), '');
  }

  // if we're not running in a CI environment or in a non-tty stdout then prompts should be available
  public static prompts_available(): boolean {
    return !(isCi || !process.stdout.isTTY);
  }

  /**
   * There is an open issue in inquirer to handle this behavior, eventually we can replace this when it's properly released:
   * https://github.com/SBoudrias/Inquirer.js/pull/891
   */
  public static disable_prompts(): void {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inquirer = require('inquirer');
    process.stdout.isTTY = false;

    inquirer.prompt = async function (prompts: any) {
      if (!Array.isArray(prompts)) {
        prompts = [prompts];
      }
      for (const prompt of prompts) {
        if ((prompt.when && prompt.default == undefined) || prompt.when === undefined) {
          throw new Error(`${prompt.name} is required`);
        }
      }
      return prompts.reduce((d: any, p: any) => {
        d[p.name] = p.default;
        return d;
      }, {});
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    inquirer.prompt.registerPrompt = function () { };
  }
}
