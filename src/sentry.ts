import { Dedupe, ExtraErrorData, RewriteFrames, Transaction } from '@sentry/integrations';
import * as Sentry from '@sentry/node';
import chalk from 'chalk';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ENVIRONMENT } from './app-config/config';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import { docker } from './common/utils/docker';
import PromptUtils from './common/utils/prompt-utils';
import { ValidationErrors } from './dependency-manager/utils/errors';
import LocalPaths from './paths';

const CLI_SENTRY_DSN = 'https://272fd53f577f4729b014701d74fe6c53@o298191.ingest.sentry.io/6465948';

export default class SentryService {
  app?: AppService;
  debug: (message: string) => void;
  child: any;
  file_out?: boolean;
  sentry_history_file_path?: string;


  static create(child: any, debug: (message: string) => void): SentryService {
    const sentry = new SentryService(child, debug);
    sentry.initSentry();
    return sentry;
  }

  constructor(child: any, debug: (message: string) => void) {
    this.child = child;
    this.debug = debug;
  }

  initSentry(): void {
    const sentry_out = process.env.TEST !== '1' && process.env.NODE_ENV != ENVIRONMENT.PREVIEW;
    Sentry.init({
      dsn: CLI_SENTRY_DSN,
      debug: false,
      environment: process.env?.NODE_ENV ?? 'production',
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
        if (!sentry_out) return null;
        if (event.req?.data?.token) {
          event.req.data.token = '*'.repeat(20);
        }
        return event;
      },
      beforeBreadcrumb(breadcrumb: any) {
        if (!sentry_out) return null;
        if (breadcrumb.category === 'console') {
          breadcrumb.message = PromptUtils.strip_ascii_color_codes_from_string(breadcrumb.message);
        }
        return breadcrumb;
      },
    });
  }

  private async getUser(): Promise<{ email: string, id: string }> {
    let user;
    try {
      user = {
        email: (await this.app?.auth?.getPersistedTokenJSON())?.email,
        id: (await this.app?.auth?.checkLogin())?.id,
      };
    } catch {
      this.debug("SENTRY: Unable to load user");
    }
    if (user && user.email !== undefined && user.id !== undefined) {
      return user as any;
    }
    return {
      email: os.hostname(),
      id: os.hostname(),
    };
  }

  async startSentryTransaction(app: AppService): Promise<void> {
    this.app = app;
    this.file_out = app.config.environment !== ENVIRONMENT.TEST && app.config.environment !== ENVIRONMENT.PREVIEW;
    this.sentry_history_file_path = path.join(app.config?.getConfigDir(), LocalPaths.SENTRY_FILENAME);

    try {
      const sentry_user = await this.getUser();

      const sentry_tags = {
        environment: this.app.config.environment,
        cli: this.app.version,
        node_runtime: process.version,
        os: os.platform(),
        shell: this.child.config?.shell,
        user: sentry_user?.id || os.hostname(),
        'user-email': sentry_user?.email || os.hostname(),
      };

      const transaction = Sentry.startTransaction({
        op: this.child.id,
        status: 'ok',
        description: sentry_user?.email || os.hostname(),
        tags: sentry_tags,
        name: this.child.name,
      });

      return Sentry.configureScope(scope => {
        scope.setSpan(transaction);
        scope.setUser(sentry_user);
        scope.setTags(sentry_tags);
      });
    } catch {
      this.debug("SENTRY: Unable to start sentry transaction");
    }
  }

  async updateSentryTransaction(error?: any): Promise<void> {
    try {
      const updated_docker_info = await this.getRunningDockerContainers();
      const config_directory_files = await this.getFilenamesFromDirectory();

      if (error) {
        error.stack = PromptUtils.strip_ascii_color_codes_from_string(error.stack);
      }

      const sentry_session_metadata = await {
        docker_info: updated_docker_info,
        linked_components: this.app?.linkedComponents,
        command: this.child.id || this.child.name,
        environment: this.app?.config.environment,
        config_dir_files: config_directory_files,
        config_file: path.join(this.app?.config?.getConfigDir() ?? '', LocalPaths.CLI_CONFIG_FILENAME),
        cwd: process.cwd(),
        log_level: this.app?.config?.log_level,
        node_versions: process.versions,
        node_version: process.version,
        os_info: os.userInfo() || {},
        os_release: os.release() || '',
        os_type: os.type() || '',
        os_platform: os.platform() || '',
        os_arch: os.arch() || '',
        os_hostname: os.hostname() || '',
        error_context: !error ? undefined : { name: error.name, message: error.message, stack: error.stack },
      };

      const update_scope = Sentry.getCurrentHub().getScope();
      update_scope?.setExtras(sentry_session_metadata);
    } catch {
      this.debug("SENTRY: Unable to attach metadata to the current transaction");
    }
  }

  async catch(error?: any): Promise<void> {
    try {
      if (error.stack) {
        error.stack = [...new Set(error.stack.split('\n'))].join("\n");
      }

      if (error instanceof ValidationErrors) {
        return prettyValidationErrors(error);
      }

      if (error.response?.data instanceof Object) {
        error.message += `\nmethod: ${error.config.method}`;
        for (const [k, v] of Object.entries(error.response.data)) {
          try {
            const msg = JSON.parse(v as any).message;
            if (!msg) { throw new Error('Invalid msg'); }
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
  }

  private async filterNonSensitiveSentryMetadata(non_sensitive: Set<string>, metadata: any): Promise<any> {
    return Object.entries(metadata)
      .filter((value,) => !!value[1] && non_sensitive.has(value[0]))
      .map(key => ({ [key[0]]: key[1] }));
  }

  async endSentryTransaction(write_command_out: boolean, inputs: any, calling_class: any, error?: any): Promise<void> {
    if (this.app && this.app?.config.environment === ENVIRONMENT.TEST) return;
    const { args, flags } = inputs;

    const non_sensitive = new Set([
      ...Object.entries(calling_class.flags || {}).filter(([_, value]) => (value as any).non_sensitive).map(([key, _]) => key),
      ...Object.entries(calling_class.args || {}).filter(([_, value]) => (value as any).non_sensitive).map(([_, value]) => (value as any).name),
    ]);

    try {
      const filtered_sentry_args = await this.filterNonSensitiveSentryMetadata(non_sensitive, args);
      const filtered_sentry_flags = await this.filterNonSensitiveSentryMetadata(non_sensitive, flags);

      await this.setScopeExtra('command_args', filtered_sentry_args);
      await this.setScopeExtra('command_flags', filtered_sentry_flags);
    } catch (err) {
      this.debug("Unable to add extra sentry metadata");
    }

    try {
      await this.updateSentryTransaction(error);

      if (this.file_out && write_command_out) {
        await this.writeCommandHistoryToFileSystem();
      }

      if (error) {
        Sentry.withScope(async scope => {
          Sentry.captureException(error, scope);
        });
      }
      Sentry.getCurrentHub().getScope()?.getSpan()?.finish();
      Sentry.getCurrentHub().getScope()?.getTransaction()?.finish();
      await Sentry.getCurrentHub().getClient()?.close();
    } catch {
      this.debug("SENTRY: Unable to save and submit the current transaction");
    }
  }

  /*
  * Helper Functions
  */
  async setScopeExtra(key: string, value: any): Promise<void> {
    try {
      const update_scope = Sentry.getCurrentHub().getScope();
      update_scope?.setExtra(key, value);
    } catch {
      this.debug("SENTRY: Unable to add extra metadata element to the current transaction");
    }
  }

  async getRunningDockerContainers(): Promise<any[]> {
    try {
      const docker_version = await docker(['version', '-f', 'json'], { stdout: false });
      const docker_info = JSON.parse(docker_version?.stdout as string);

      const docker_command = await docker(['ps', '--format', '{{json .}}%%'], { stdout: false });
      const docker_stdout = (docker_command.stdout as string).split('%%')
        .map((str: string) => (str && str.length) ? JSON.parse(str) : undefined);
      const docker_containers = docker_stdout.filter(x => !!x).map((container: any) => ({ ...container, Labels: undefined }));

      const updated_docker_info = Object.assign(docker_info, { Containers: docker_containers });

      return updated_docker_info;
    } catch {
      this.debug("SENTRY: Unable to retrieve running docker container metadata");
      return [];
    }
  }

  async getFilenamesFromDirectory(): Promise<any[]> {
    try {
      const path = this.app?.config?.getConfigDir();
      const addr = fs.readdirSync(path ?? '', { withFileTypes: true });
      return addr.filter(f => f.isFile()).map(f => ({ name: f.name })) || [];
    } catch {
      this.debug("SENTRY: Unable to read list of file names from the architect config directory");
      return [];
    }
  }

  async readCommandHistoryFromFileSystem(): Promise<any[]> {
    try {
      if (fs.existsSync(this.sentry_history_file_path ?? '')) {
        return await JSON.parse(fs.readFileSync(this.sentry_history_file_path ?? '').toString()) || [];
      }
    } catch {
      this.debug("SENTRY: Unable to read command history file from the architect config directory");
    }
    return [];
  }

  async writeCommandHistoryToFileSystem(): Promise<void> {
    try {
      const scope = Sentry.getCurrentHub()?.getScope();
      const remove_keys = new Set(['plugins', 'pjson', 'oauth_client_id', 'credentials', '_auth_result', 'Authorization']);

      // remove empty objects, empty strings, or key/values from the remove_keys list.
      let current_output = JSON.parse(JSON.stringify(scope as any, (key, value) => {
        if (remove_keys.has(key)) {
          return undefined;
        }
        if (typeof value === 'number' || (value && Object.keys(value).length)) {
          return value;
        }
      }));

      // remove duplicate report information if span is present
      if (current_output._span) {
        current_output = { ...current_output, _tags: undefined, _user: undefined };
      }

      if (!this.sentry_history_file_path) {
        return;
      }

      if (!fs.existsSync(this.sentry_history_file_path)) {
        return fs.outputJsonSync(this.sentry_history_file_path, [current_output], { spaces: 2 });
      }

      const history = await JSON.parse(fs.readFileSync(this.sentry_history_file_path).toString());
      history.push(current_output);
      // append to end, pop from top the last min(defined maximum history length, current history length) records

      const maximum_records = ~Math.min(5, history.length) + 1;
      fs.outputJsonSync(this.sentry_history_file_path, history.slice(maximum_records), { spaces: 2 });
    } catch {
      this.debug("SENTRY: Unable to write command history file to the architect config directory");
    }
  }

}
