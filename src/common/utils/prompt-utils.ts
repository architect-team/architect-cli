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

  public static allowWhen(error_msg: string, value?: any | undefined): boolean {
    if (value) {
      return false;
    }

    if (!this.prompts_available()) {
      throw new Error(error_msg);
    }
    return true;
  }
}
