import { flags } from '@oclif/command';
import chalk from 'chalk';
import opener from 'opener';
import Command from '../base-command';
import PortUtil from '../common/utils/port';
import PromptUtils from '../common/utils/prompt-utils';
import inquirer = require('inquirer');

export default class Login extends Command {
  auth_required() {
    return false;
  }

  static description = 'Login to the Architect Cloud platform';

  static flags = {
    ...Command.flags,
    email: flags.string({
      char: 'e',
      description: 'Email',
      env: 'ARCHITECT_EMAIL',
    }),
    password: flags.string({
      char: 'p',
      description: 'Password',
      env: 'ARCHITECT_PASSWORD',
    }),
  };

  async run() {
    const { flags } = this.parse(Login);

    if (flags.email || flags.password) {
      await this.run_cli_flow(flags);
    } else {
      await this.run_browser_flow();
    }

    this.log(chalk.green('Login successful'));
  }

  private async run_browser_flow() {
    if (!PromptUtils.prompts_available()) {
      throw new Error('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -e <email> -p <password>`');
    }
    const port = await PortUtil.getAvailablePort(60000);

    const url = this.app.auth.generate_browser_url(port);

    try {
      this.log('To login, please navigate to the following URL in your browser:');
      this.log('\n');
      this.log(`\t${url}`);
      opener(url);
    } catch (err) {
      // do nothing if opener fails
    }

    await this.app.auth.login_from_browser(port);
  }

  private async run_cli_flow(flags: any) {
    let answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        default: flags.email,
        when: !flags.email,
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

    await this.app.auth.login_from_cli(answers.email, answers.password);
  }
}
