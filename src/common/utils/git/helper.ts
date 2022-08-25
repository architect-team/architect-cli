import which from 'which';

class _GitHelper {
  git_installed: boolean;

  constructor() {
    this.git_installed = this.checkGitInstalled();
  }

  static getTestHelper(): _GitHelper {
    const helper = new _GitHelper();
    helper.git_installed = true;
    return helper;
  }

  checkGitInstalled(): boolean {
    try {
      which.sync('git');
      return true;
    } catch {
      return false;
    }
  }

  verifyGit(): void {
    if (!this.git_installed) {
       throw new Error('Architect requires git to be installed in order for this command to run.\nPlease install git and try again: https://git-scm.com/book/en/v2/Getting-Started-Installing-Git');
    }
  }
}

// Create a singleton GitHelper
export const GitHelper = process.env.TEST === '1' ? _GitHelper.getTestHelper() : new _GitHelper();

/**
 * Used to wrap `Command.run()` or `Command.runLocal()` methods when git is required.
 * Should be used as close to the run method as possible so the checks for required git features happen
 * before any work begins.
 */
export function RequiresGit(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const wrappedFunc = descriptor.value;
    descriptor.value = function (this: any, ...args: any[]) {

      // Verify that git is installed
      GitHelper.verifyGit();

      return wrappedFunc.apply(this, args);
    };
    return descriptor;
  };
}
