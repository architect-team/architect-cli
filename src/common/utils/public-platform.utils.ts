import inquirer = require('inquirer');
import { CreatePublicPlatformInput } from '../../commands/environments/create';
import { EnvironmentNameValidator } from './validation';

export class PublicPlatformUtils {
  public static async runArchitectPublic(
    args: any,
    flags: any,
  ): Promise<CreatePublicPlatformInput> {

    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What would you like to name your new platform?',
        when: !args.name,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: flags.namespace || '',
      },
    ]);

    return {
      name: args.name || answers.name,
    };
  }
}
