import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import untildify from 'untildify';
import { CreatePlatformInput } from '../../commands/environments/create';
import { EnvironmentNameValidator } from './validation';

export class EcsPlatformUtils {

  public static async configure_ecs_platform(
    args: any,
    flags: any,
    account: { id: string; name: string },
  ): Promise<CreatePlatformInput> {

    let awsconfig: any;
    let awscreds: any;

    if (flags.awsconfig) {
      const awsconfig_path = untildify(`${flags.awsconfig}/config`);
      const awscreds_path = untildify(`${flags.awsconfig}/credentials`);
      try {
        awsconfig = await fs.readFile(path.resolve(awsconfig_path), 'utf-8');
      } catch {
        throw new Error(`No awsconfig found at ${awsconfig_path}`);
      }
      try {
        awscreds = await fs.readFile(path.resolve(awscreds_path), 'utf-8');
      } catch {
        throw new Error(`No aws credentials found at ${awscreds_path}`);
      }
    }

    const new_platform_answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        when: !args.name,
        message: 'What would you like to name the new platform?',
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: () => `${account.name}-ecs`,
      },
      {
        type: 'input',
        name: 'aws_region',
        when: !flags.awsconfig && !flags.aws_region,
        message: 'In which AWS region would you like Architect to operate?',
      },
      {
        type: 'input',
        name: 'aws_key',
        when: !flags.awsconfig && !flags.aws_key,
        message: 'What is the AccessKeyId for the AWS user that Architect will drive?',
      },
      {
        type: 'input',
        name: 'aws_secret',
        when: !flags.awsconfig && !flags.aws_secret,
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
      name: args.name || new_platform_answers.name,
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
