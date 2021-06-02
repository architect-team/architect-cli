import { flags } from '@oclif/command';
import btoa from "btoa";
import chalk from 'chalk';
import opener from 'opener';
import { AuthorizationCode } from 'simple-oauth2';
import Command from '../base-command';
import * as Docker from '../common/utils/docker';
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
    await Docker.verify(); // docker is required for login because we run `docker login`

    if (this.app.config.ory_auth) {
      // refresh tokens are the main thing in question (Auth0Shim is only for refresh) (try finding an oauth module for refresh, equivalent to nuxt oauth) (kill Auth0Shim with new module)
      await this.runOryBrowserFlow();
    } else {
      if (flags.email || flags.password) {
        await this.runCliFlow(flags);
      } else {
        await this.runBrowserFlow();
      }
    }

    this.log(chalk.green('Login successful'));
  }

  private async runOryBrowserFlow() {
    if (!PromptUtils.prompts_available()) {
      throw new Error('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -e <email> -p <password>`');
    }

    const auth_client: AuthorizationCode<'client_id'> = this.app.auth.getOryAuthClient();
    const authorization_uri: string = auth_client.authorizeURL({
      redirect_uri: 'http://localhost:60000',
      scope: 'openid profile email offline_access',
      state: btoa(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
    });

    const port = await PortUtil.getAvailablePort(60000);

    try {
      this.log('To login, please navigate to the following URL in your browser:');
      this.log('\n');
      this.log(`\t${authorization_uri}`);
      opener(authorization_uri);
    } catch (err) {
      // do nothing if opener fails
    }

    await this.app.auth.oryLoginFromBrowser(port, auth_client);
  }

  private async runBrowserFlow() {
    if (!PromptUtils.prompts_available()) {
      throw new Error('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -e <email> -p <password>`');
    }
    const port = await PortUtil.getAvailablePort(60000);

    const url = this.app.auth.generateBrowserUrl(port);

    try {
      this.log('To login, please navigate to the following URL in your browser:');
      this.log('\n');
      this.log(`\t${url}`);
      opener(url);
    } catch (err) {
      // do nothing if opener fails
    }

    await this.app.auth.loginFromBrowser(port);
  }

  private async runCliFlow(flags: any) {
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

    await this.app.auth.loginFromCli(answers.email, answers.password);
  }
}
