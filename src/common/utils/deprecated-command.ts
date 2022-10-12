import chalk from 'chalk';

export function DeprecatedCommand(options: { newAliases?: string[] }): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const wrappedFunc = descriptor.value;
    descriptor.value = function (this: any, ...args: any[]) {
      let message = 'This command is deprecated.';

      if (options.newAliases) {
        message = `${message} Please use any of the following commands instead: ${options.newAliases.join(', ')}`;
      }

      this.log(chalk.yellow(message));

      return wrappedFunc.apply(this, args);
    };
    return descriptor;
  };
}
