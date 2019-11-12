import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Command from '../base';

const _error = chalk.red;
const _success = chalk.green;

export default class Login extends Command {
  static description = 'Log in to an Architect registry';

  static flags = {
    help: flags.help({ char: 'h' }),
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
    this.log('Login with your Architect ID to push and pull images from Architect Hub.');
    const answers: any = await this.promptOptions();
    try {
      await this.login(answers.username, answers.password);
    } catch (err) {
      this.error(_error(err.message));
    }
  }

  async promptOptions() {
    const { flags } = this.parse(Login);
    const answers = await inquirer.prompt([{
      type: 'input',
      name: 'username',
      when: !flags.username,
    }, {
      type: 'password',
      name: 'password',
      when: !flags.password,
    }]);
    return { ...flags, ...answers };
  }

  async login(username: string, password: string) {
    try {
      await this.architect.login(username, password);
      this.log(_success('Login Succeeded'));
    } catch (err) {
      this.log(_error('Login Failed'));
      throw err;
    }
  }
}
