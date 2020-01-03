import { flags } from '@oclif/command';
import chalk from 'chalk';
import Command from '../base-command';
import inquirer = require('inquirer');

export default class Login extends Command {
  auth_required() {
    return false;
  }

  static description = 'Login to the Architect Cloud platform';

  static flags = {
    ...Command.flags,
    username: flags.string({
      char: 'u',
      description: 'Username',
      env: 'ARCHITECT_USERNAME',
    }),
    password: flags.string({
      char: 'p',
      description: 'Password',
      env: 'ARCHITECT_PASSWORD',
    }),
  };

  async run() {
    const { flags } = this.parse(Login);

    let answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        default: flags.username,
        when: !flags.username,
      },
      {
        type: 'password',
        name: 'password',
        default: flags.password,
        when: !flags.password,
      },
    ]);

    answers = {
      ...flags,
      ...answers,
    };

    await this.app.auth.login(answers.username, answers.password);
    this.log(chalk.green('Login successful'));
  }
}
