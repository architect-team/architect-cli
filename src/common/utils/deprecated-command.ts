import chalk from 'chalk';

export function DeprecatedCommand(options: { new_aliases?: string[] }): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const wrappedFunc = descriptor.value;
    descriptor.value = function (this: any, ...args: any[]) {
      let message = 'This command is deprecated.';

      if (options.new_aliases) {
        message = `${message} Please use any of the following commands instead: ${options.new_aliases.join(', ')}.`;
      }

      this.log(chalk.yellow(message));

      return wrappedFunc.apply(this, args);
    };
    return descriptor;
  };
}
