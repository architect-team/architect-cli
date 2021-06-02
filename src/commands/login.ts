import { flags } from '@oclif/command';
import btoa from "btoa";
import chalk from 'chalk';
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
      // run ory browser flow
      // refresh tokens are the main thing in question (Auth0Shim is only for refresh) (try finding an oauth module for refresh, equivalent to nuxt oauth) (kill Auth0Shim with new module)

      const config = {
        client: {
          id: 'postman7',
          secret: 'postman7', // 'secret' - TODO: does this need to be valid for our flow? or is it just required in the module's type?
        },
        auth: {
          tokenHost: 'http://auth-frontend-0jdostdd.arc.localhost:1024',
          tokenPath: '/oauth2/token',
          authorizeHost: 'http://auth-frontend-0jdostdd.arc.localhost:1024',
          authorizePath: '/oauth2/auth'
        }
      };
      const client = new AuthorizationCode(config);

      const authorizationUri = client.authorizeURL({
        redirect_uri: 'http://localhost:60000',
        scope: 'openid profile email offline_access',
        state: btoa(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
      });

      await this.runBrowserFlow(authorizationUri, client);
    } else {
      if (flags.email || flags.password) {
        await this.runCliFlow(flags);
      } else {
        await this.runBrowserFlow();
      }
    }

    this.log(chalk.green('Login successful'));
  }

  private async runBrowserFlow(hydra_url?: string, authorization_code?: AuthorizationCode) {
    if (!PromptUtils.prompts_available()) {
      throw new Error('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -e <email> -p <password>`');
    }
    const port = await PortUtil.getAvailablePort(60000);

    const url = hydra_url || this.app.auth.generateBrowserUrl(port);

    try {
      this.log('To login, please navigate to the following URL in your browser:');
      this.log('\n');
      this.log(`\t${url}`);
      opener(url);
    } catch (err) {
      // do nothing if opener fails
    }

    await this.app.auth.loginFromBrowser(port, authorization_code);
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
