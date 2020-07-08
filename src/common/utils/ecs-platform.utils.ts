import inquirer from 'inquirer';
import { CreatePlatformInput } from '../../commands/platforms/create';

export class EcsPlatformUtils {

  public static async configure_ecs_platform(
    flags: any,
  ): Promise<CreatePlatformInput> {
    const new_platform_answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'aws_region',
        when: !flags.aws_region,
        message: 'In which AWS region would you like Architect to operate?',
      },
      {
        type: 'input',
        name: 'aws_key',
        when: !flags.aws_key,
        message: 'What is the AccessKeyId for the AWS user that Architect will drive?',
      },
      {
        type: 'input',
        name: 'aws_secret',
        when: !flags.aws_secret,
        message: 'What is the SecretAccessKey for the AWS user that Architect will drive?',
      },
    ]);

    if (new_platform_answers.use_existing_sa === false) {
      throw new Error('Please select another service account name');
    }

    // TODO:107:CLI: create a new AWS account with proper permissions here.
    // take these values from the config file and create a "platform agent" with the appropriate
    // permissions on the user's behalf

    return {
      type: 'ECS',
      description: 'description',
      credentials: {
        kind: 'ECS',
        region: flags.aws_region || new_platform_answers.aws_region,
        access_key: flags.aws_key || new_platform_answers.aws_key,
        access_secret: flags.aws_secret || new_platform_answers.aws_secret,
      },
    };
  }
}
