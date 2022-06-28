import { Command, Interfaces } from '@oclif/core';
import { Dedupe, ExtraErrorData, RewriteFrames, Transaction } from '@sentry/integrations';
import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import chalk from 'chalk';
import os from 'os';
import path from 'path';
import { ValidationErrors } from './';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import LoginRequiredError from './common/errors/login-required';
import { docker } from './common/utils/docker';
import PromptUtils from './common/utils/prompt-utils';
import LocalPaths from './paths';

const DEPRECATED_LABEL = '[deprecated]';
const CLI_SENTRY_DSN = 'https://272fd53f577f4729b014701d74fe6c53@o298191.ingest.sentry.io/6465948';

export default abstract class BaseCommand extends Command {
  static readonly DEPRECATED: string = DEPRECATED_LABEL;

  app!: AppService;
  accounts?: any;
  oclif_env?: string;

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

  async _filterNonSensitiveSentryMetadata(non_sensitive: Set<string>, metadata: any): Promise<any> {
    return Object
      .entries(metadata)
      .filter((value,) => non_sensitive.has(value[0]))
      .map(key => ({ [key[0]]: key[1] }));
  }

  async _getNonSensitiveSentryMetadata(_args?: any[], _flags?: any[]): Promise<any> {
    const calling_class = this.constructor as any;

    const non_sensitive = new Set([
      ...Object.entries(calling_class.flags || {}).filter(([_, value]) => (value as any).non_sensitive).map(([key, _]) => key),
      ...Object.entries(calling_class.args || {}).filter(([_, value]) => (value as any).non_sensitive).map(([_, value]) => (value as any).name),
    ]);

    const { args, flags } = await this.parse(calling_class);

    const filtered_sentry_args = await this._filterNonSensitiveSentryMetadata(non_sensitive, _args || args);
    const filtered_sentry_flags = await this._filterNonSensitiveSentryMetadata(non_sensitive, _flags || flags);

    return { filtered_sentry_args, filtered_sentry_flags };
  }

  async setupAnalytics(): Promise<void> {
    const analytics_env = this.oclif_env;
    Sentry.init({
      dsn: CLI_SENTRY_DSN,
      debug: false,
      environment: analytics_env,
      release: process.env?.npm_package_version,
      tracesSampleRate: 1.0,
      attachStacktrace: true,
      sendClientReports: true,
      integrations: [
        new Dedupe(),
        new RewriteFrames({
          root: LocalPaths.SENTRY_ROOT_PATH,
          prefix: `src/`,
        }),
        new ExtraErrorData(),
        new Transaction(),
      ],
      beforeSend(event: any) {
        if (analytics_env === 'local') return null;
        if (event.req?.data?.token) {
          event.req.data.token = '*'.repeat(20);
        }
        return event;
      },
    });

    const auth_user = await this.app?.auth?.getPersistedTokenJSON();
    const auth_login = await this.app?.auth?.checkLogin();

    const sentry_session_tags = {
      environment: analytics_env,
      cli: this.app.version,
      node_runtime: process.version,
      os: os.platform(),
      shell: this.config?.shell,
      user: auth_login?.id || os.hostname(),
      'user-email': auth_user?.email || os.hostname(),
    };

    const sentry_session_user = {
      email: auth_user?.email || os.hostname(),
      id: auth_login?.id || os.hostname(),
    };

    const docker_version = await docker(['version', '-f', 'json'], { stdout: false });
    const docker_containers = await docker(['ps', '--format', '{"ID":"{{ .ID }}", "Image": "{{ .Image }}", "Name":"{{ .Names }}"},'], { stdout: false });

    const sentry_session_docker_containers = JSON.parse(`[${(docker_containers.stdout as string)
      .substring(0, (docker_containers.stdout as string).length - 1)}]`);
    const sentry_session_docker_version = JSON.parse(docker_version.stdout as string);

    const sentry_session_metadata = {
      command: this.id || (this.constructor as any).name,
      environment: analytics_env,
      email: auth_user?.email || '',
      id: auth_login?.id || os.hostname(),
      config_file: path.join(this.app?.config?.getConfigDir(), LocalPaths.CLI_CONFIG_FILENAME),
      cwd: process.cwd(),
      docker_info: sentry_session_docker_version,
      docker_containers: sentry_session_docker_containers,
      linked_components: this.app?.linkedComponents,
      log_level: this.app?.config?.log_level,
      node_versions: process.versions,
      node_version: process.version,
      os_info: os.userInfo() || {},
      os_release: os.release() || '',
      os_type: os.type() || '',
      os_platform: os.platform() || '',
      os_arch: os.arch() || '',
      os_hostname: os.hostname() || '',
    };

    return Sentry.configureScope(scope => {
      scope.setExtras({ ...sentry_session_metadata });
      scope.setTags({ ...sentry_session_tags });
      scope.setUser({ ...sentry_session_user });
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

    if (this.app && this.app.config) {
      let api_host = (this.app.config.api_host || 'http://api.arc.localhost').replace(/^https?:\/\//, '');
      if (!api_host || api_host.length === 0) {
        return;
      }
      api_host = api_host.trim().toLowerCase();
      if (api_host === 'api.architect.io') {
        this.oclif_env = 'production';
      }
      else if (api_host === 'api.dev.architect.io') {
        this.oclif_env = 'dev';
      } else {
        this.oclif_env = 'local';
      }
      try {
        return await this.setupAnalytics();
      }
      catch {
        // nothing to do
      }
    }
  }

  async finally(_: Error | undefined): Promise<any> {

    if (this.oclif_env !== 'local' && _) {
      const cur_scope = Sentry.getCurrentHub()?.getScope();
      if (_.stack) {
        cur_scope?.setExtra('stack', _.stack = PromptUtils.strip_ascii_color_codes_from_string(_.stack));
      }
      Sentry.withScope(scope => Sentry.captureException(_));
    }

    return super.finally(_);
  }

  // Move all args to the front of the argv to get around: https://github.com/oclif/oclif/issues/190
  protected async parse<F, A extends {
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

  async catch(err: any): Promise<void> {
    if (err.oclif && err.oclif.exit === 0) return;

    if (err.stack) {
      err.stack = [...new Set(err.stack.split('\n'))].join("\n");
    }

    const { filtered_sentry_args, filtered_sentry_flags } = await this._getNonSensitiveSentryMetadata();

    Sentry.configureScope(scope => {
      scope?.setExtra('command_args', filtered_sentry_args);
      scope?.setExtra('command_flags', filtered_sentry_flags);
    });

    if (err instanceof ValidationErrors) {
      return prettyValidationErrors(err);
    }

    try {
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
        err.message += `\nstderr:\n${err.stderr}\n`;
      }

      console.error(chalk.red(err.message));

    } catch {
      this.warn('Unable to add more context to error message');
    }

    try {
      return await super.catch(err);
    } finally {
      this.finally(err);
    }
  }
}
