import { Command, Config, Interfaces } from '@oclif/core';
import '@sentry/tracing';
import chalk from 'chalk';
import { Memoize } from 'typescript-memoize';
import { Dictionary, ValidationErrors } from '.';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import LoginRequiredError from './common/errors/login-required';
import { isBooleanStringFlag } from './common/utils/oclif';
import SentryService from './sentry';

export default abstract class BaseCommand extends Command {
  app: AppService;
  sentry: SentryService;

  async auth_required(): Promise<boolean> {
    return true;
  }

  constructor(argv: string[], config: Config) {
    super(argv, config);
    this.app = AppService.create(this.config.configDir, this.config.userAgent.split(/\/|\s/g)[2]);
    this.sentry = new SentryService(this);
  }

  // override debug being a protected method on the oclif Command class
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  debug(...args: any[]): void {
    return super.debug(...args);
  }

  async init(): Promise<void> {
    await this.app.auth.init();

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

    this.warnIfCommandDeprecated();
    await this.sentry.startSentryTransaction();
  }

  @Memoize()
  async parse<F, A extends { // Move all args to the front of the argv to get around: https://github.com/oclif/oclif/issues/190
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const flag_definitions = this.getClass().flags;

    const flags_map: Dictionary<Interfaces.CompletableFlag<any> | undefined> = {};
    for (const [flag_name, flag_definition] of Object.entries(flag_definitions)) {
      flags_map[`--${flag_name}`] = flag_definition;
      if (flag_definition.char) {
        flags_map[`-${flag_definition.char}`] = flag_definition;
      }
    }

    // Need to handle the following cases: `--auto-approve` `--auto-approve=true` `--auto-approve true`
    for (const [index, arg] of argv.entries()) {
      const flag_obj = flags_map[arg];
      if (isBooleanStringFlag(flag_obj)) {
        const next_arg = argv[index + 1] as string | undefined;
        if (!next_arg || next_arg.startsWith('-') || !['true', 'false'].includes(next_arg.toLowerCase())) {
          argv[index] = `${arg}=true`;
        }
      }
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
        const flag_obj = flags_map[arg.split('=', 1)[0]];
        flag_option = flag_obj?.type === 'option' && !arg.includes('=');
      } else {
        flag_option = false;
      }
    }

    return super.parse(options, [...args, ...flags]);
  }

  async finally(err: Error | undefined): Promise<any> {
    await this.sentry.endSentryTransaction(err);

    // Oclif supers go as the return
    return super.finally(err);
  }

  async catch(error: any): Promise<void> {
    if (error.oclif && error.oclif.exit === 0) return;

    try {
      if (error.stack) {
        error.stack = [...new Set(error.stack.split('\n'))].join('\n');
      }

      if (error instanceof ValidationErrors) {
        prettyValidationErrors(error);
        return super.catch({ ...error, message: '' });
      }

      if (error.response?.data instanceof Object) {
        error.message += `\nmethod: ${error.config.method}`;
        for (const [k, v] of Object.entries(error.response.data)) {
          try {
            const msg = JSON.parse(v as any).message;
            if (!msg) {
              throw new Error('Invalid msg');
            }
            error.message += `\n${k}: ${msg}`;
          } catch {
            error.message += `\n${k}: ${v}`;
          }
        }
      }

      if (error.stderr) {
        error.message += `\nstderr:\n${error.stderr}\n`;
      }

      console.error(chalk.red(error.message));
    } catch {
      this.debug('Unable to add more context to error message');
    }
    // Oclif supers go as the return
    return super.catch(error);
  }

  getClass(): typeof BaseCommand {
    return this.constructor as any;
  }
}
