import { Flags } from '@oclif/core';
import chalk from 'chalk';
import opener from 'opener';
import { AuthorizationCode } from 'simple-oauth2';
import AuthClient from '../app-config/auth';
import Command from '../base-command';
import * as Docker from '../common/utils/docker';
import PortUtil from '../common/utils/port';
import PromptUtils from '../common/utils/prompt-utils';
import inquirer = require('inquirer');

export default class Login extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Login to the Architect Cloud platform';

  static flags = {
    ...Command.flags,
    email: Flags.string({
      char: 'e',
      description: 'Email',
      env: 'ARCHITECT_EMAIL',
    }),
    password: Flags.string({
      char: 'p',
      description: 'Password',
      env: 'ARCHITECT_PASSWORD',
    }),
  };

  static sensitive = new Set([...Object.keys({ ...this.flags })]);

  static non_sensitive = new Set();

  async run(): Promise<void> {
    try {
      const { flags } = await this.parse(Login);
      await Docker.verify(); // docker is required for login because we run `docker login`

      if (flags.email || flags.password) {
        await this.runCliFlow(flags);
      } else {
        await this.runBrowserFlow();
      }
      this.log(chalk.green('Login successful'));
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }

  private async runBrowserFlow() {
    try {
      if (!PromptUtils.prompts_available()) {
        throw new Error('We detected that this environment does not have a prompt available. To login in a non-tty environment, please use both the user and password options: `architect login -e <email> -p <password>`');
      }

      const port = await PortUtil.getAvailablePort(60000);
      const auth_client: AuthorizationCode<'client_id'> = this.app.auth.getAuthClient();
      const authorization_uri: string = auth_client.authorizeURL({
        redirect_uri: `http://localhost:${port}`,
        scope: AuthClient.SCOPE,
        state: Buffer.from(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)).toString('base64'),
      });

      try {
        this.log('To login, please navigate to the following URL in your browser:');
        this.log('\n');
        this.log(`\t${authorization_uri}`);
        opener(authorization_uri);
      } catch (err) {
        // do nothing if opener fails
      }

      await this.app.auth.loginFromBrowser(port, auth_client);

    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }

  private async runCliFlow(flags: any) {
    try {
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
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }
}

