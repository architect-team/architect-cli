import which from 'which';
import { ArchitectError } from '../../dependency-manager/utils/errors';

class _KubectlHelper {
  kubectl_installed: boolean;

  constructor() {
    this.kubectl_installed = this.checkKubectlInstalled();
  }

  static getTestHelper(): _KubectlHelper {
    const helper = new _KubectlHelper();
    helper.kubectl_installed = true;
    return helper;
  }

  checkKubectlInstalled(): boolean {
    try {
      which.sync('kubectl');
      return true;
    } catch {
      return false;
    }
  }

  verifyKubectl(): void {
    if (!this.kubectl_installed) {
      throw new ArchitectError('Architect requires Kubectl to be installed.\nPlease install kubectl and try again: https://kubernetes.io/docs/tasks/tools/#kubectl');
    }
  }
}

export const KubernetesHelper = process.env.TEST === '1' ? _KubectlHelper.getTestHelper() : new _KubectlHelper();

/**
 * Used to wrap functions that require kubectl. Makes sure that kubectl is installed
 * before work begins.
 */
export function RequiresKubectl(): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const wrappedFunc = descriptor.value;
    descriptor.value = function (this: any, ...args: any[]) {
      // We always want to verify kubectl is installed
      KubernetesHelper.verifyKubectl();

      return wrappedFunc.apply(this, args);
    };
    return descriptor;
  };
}
