import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import inquirer from 'inquirer';
import keytar from 'keytar';

import Command from '../base';

const _error = chalk.red;
const _success = chalk.green;

export default class Login extends Command {
  static description = 'Log in to a Architect registry';

  static flags = {
    help: flags.help({ char: 'h' }),
    username: flags.string({
      char: 'u',
      description: 'Username'
    }),
    password: flags.string({
      char: 'p',
      description: 'Password'
    })
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
      when: !flags.username
    }, {
      type: 'password',
      name: 'password',
      when: !flags.password
    }]);
    return { ...flags, ...answers };
  }

  async login(username: string, password: string) {
    const registry_domain = this.app_config.default_registry_host;
    await execa('docker', ['login', registry_domain, '-u', username, '--password-stdin'], { input: password });
    await keytar.setPassword('architect.io', username, password);
    this.log(_success('Login Succeeded'));
  }
}
