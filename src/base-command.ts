import { Command, Interfaces } from '@oclif/core';
import { Dedupe, ExtraErrorData, RewriteFrames, Transaction } from '@sentry/integrations';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import { ValidationErrors } from './';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import LoginRequiredError from './common/errors/login-required';
import LocalPaths from './paths';

const DEPRECATED_LABEL = '[deprecated]';
const CLI_SENTRY_DSN = 'https://52645738b46a4989986c80bb40d39eaa@o298191.ingest.sentry.io/6377983';

export default abstract class BaseCommand extends Command {
  static readonly DEPRECATED: string = DEPRECATED_LABEL;

  app!: AppService;
  accounts?: any;

  async auth_required(): Promise<boolean> {
    return true;
  }

  static flags = {};

  checkFlagDeprecations(flags: any, flag_definitions: any): void {
    Object.keys(flags).forEach((flagName: string) => {
      const flag_config = flag_definitions[flagName] || {};
      const description = flag_config.description || '';
      if (description?.startsWith(DEPRECATED_LABEL)) {
        this.warn(`Flag --${flagName} is deprecated.${description.split(DEPRECATED_LABEL)[1]}`);
      }
    });
  }

  async init(): Promise<void> {
    const { flags } = await this.parse(this.constructor as any);
    const flag_definitions = (this.constructor as any).flags;
    this.checkFlagDeprecations(flags, flag_definitions);

    if (!this.app) {
      this.app = await AppService.create(this.config.configDir, this.config.userAgent.split(/\/|\s/g)[2]);
      if (await this.auth_required()) {
        const token_json = await this.app.auth.getPersistedTokenJSON();
        if (!token_json) {
          throw new LoginRequiredError();
        }
        if (token_json.email === 'unknown') {
          throw new LoginRequiredError();
        }
        if (token_json.expires_in) {
          const auth_client = this.app.auth.getAuthClient();
          const access_token = auth_client.createToken(token_json);
          if (access_token.expired()) {
            throw new LoginRequiredError();
          }
        }
      }
    }
  }

  // Move all args to the front of the argv to get around: https://github.com/oclif/oclif/issues/190
  protected parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const flag_definitions = (this.constructor as any).flags;

    // Support -- input ex. architect exec -- ls -la
    const double_dash_index = argv.indexOf('--');
    if (double_dash_index >= 0) {
      const command = argv.slice(double_dash_index + 1, argv.length).join(' ');
      argv = argv.slice(0, double_dash_index);
      argv.unshift(command);
    }

    const args = [];
    const flags = [];
    let flag_option = false;
    for (const arg of argv) {
      const is_flag = arg.startsWith('-');

      if (is_flag || flag_option) {
        flags.push(arg);
      } else {
        args.push(arg);
      }

      if (is_flag) {
        const flag = arg.startsWith('--') ? flag_definitions[arg.replace('--', '')] : Object.values(flag_definitions).find((f: any) => f.char === arg.replace('-', ''));
        flag_option = flag?.type === 'option';
      } else {
        flag_option = false;
      }
    }

    return super.parse(options, [...args, ...flags]);
  }

  async _logToSentry(err: any): Promise<void> {
    const auth_result = await this.app.auth.getPersistedTokenJSON();
    const auth_user = await this.app.auth.checkLogin();
    const config_dir = this.app.config.getConfigDir();
    const active_config_file = path.join(config_dir, LocalPaths.CLI_CONFIG_FILENAME);
    const docker_version = execSync('docker version --format \'{{json .}}\'').toString();

    Sentry.init({
      dsn: CLI_SENTRY_DSN,
      debug: false,
      attachStacktrace: true,
      environment: this.config.bin,
      integrations: [
        new Dedupe(),
        new RewriteFrames({
          root: __dirname || process.cwd(),
        }),
        new ExtraErrorData(),
        new Transaction(),
      ],
      beforeSend(event: any) {
        // Prevent sending sensitive information like access tokens to sentry
        if (event.req?.data?.token) {
          event.req.data.token = '*'.repeat(event.req?.data?.token.length);
        }
        return event;
      },
      initialScope: {
        user: { id: auth_user.id, email: auth_result?.email },
        extra: {
          command_metadata: (await this.parse(this.constructor as any)).raw,
          linked_components: this.app.linkedComponents,
          cli_version: this.app.version,
          shell: this.config.bin,
          docker_info: docker_version,
          os_platform: os.platform(),
          os_type: os.type(),
          os_release: os.release(),
          node_version: process.version,
          config_dir: config_dir,
          log_level: this.app.config.log_level,
          registry_host: this.app.config.registry_host,
          api_host: this.app.config.api_host,
          app_host: this.app.config.app_host,
          account: this.app.config.account,
          cwd: process.cwd(),
          active_config_file: active_config_file,
        },
        tags: {
          os: os.platform(),
          node_runtime: process.version,
          user: auth_user.name || auth_result?.email,
          'user-email': auth_result?.email,
          cli: this.app.version,
          shell: this.config.bin,
        }
      },
    });
    err.code = err.response.status;
    err.description = err.response.statusText;
    return Sentry.withScope(scope => Sentry.captureException(err));
  }

  async catch(err: any): Promise<void> {
    if (err.oclif && err.oclif.exit === 0) return;

    if (err instanceof ValidationErrors) {
      prettyValidationErrors(err);
      return this._logToSentry(err);
    }

    if (err.response?.data instanceof Object) {
      err.message += `\nmethod: ${err.config.method}`;
      for (const [k, v] of Object.entries(err.response.data)) {
        try {
          const msg = JSON.parse(v as any).message;
          if (!msg) { throw new Error('Invalid msg'); }
          err.message += `\n${k}: ${msg}`;
        } catch {
          err.message += `\n${k}: ${v}`;
        }
      }
    }

    if (err.stderr) {
      err.message += `\nstderr: ${err.stderr}`;
    }

    console.error(chalk.red(err.message));

    return this._logToSentry(err);
  }
}
