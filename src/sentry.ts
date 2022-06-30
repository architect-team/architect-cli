import { Dedupe, ExtraErrorData, RewriteFrames, Transaction } from '@sentry/integrations';
import * as Sentry from '@sentry/node';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import AppService, { APP_ENV } from './app-config/service';
import { docker } from './common/utils/docker';
import PromptUtils from './common/utils/prompt-utils';
import LocalPaths from './paths';

const CLI_SENTRY_DSN = 'https://272fd53f577f4729b014701d74fe6c53@o298191.ingest.sentry.io/6465948';

export default class SentryService {
  app: AppService;
  child: any;
  file_out: boolean;
  sentry_out: boolean;
  sentry_history_file_path: string;

  static async create(app: AppService, child: any): Promise<SentryService> {
    const sentry = new SentryService(app, child);
    await sentry.startSentryTransaction();
    return sentry;
  }

  constructor(app: AppService, child: any) {
    this.app = app;
    this.child = child;
    this.file_out = app.environment !== APP_ENV.TEST;
    this.sentry_history_file_path = path.join(app.config?.getConfigDir(), LocalPaths.SENTRY_FILENAME);
    this.sentry_out = (app.environment === APP_ENV.PRODUCTION || app.environment === APP_ENV.DEV);
    this.startSentryTransaction();
  }

  async startSentryTransaction(): Promise<void> {

    const sentry_out = this.sentry_out;
    let sentry_user: any;
    try {
      sentry_user = {
        email: (await this.app.auth?.getPersistedTokenJSON())?.email,
        id: (await this.app.auth?.checkLogin())?.id,
      };
    } catch {
      sentry_user = {
        email: os.hostname(),
        id: os.hostname(),
      };
    }

    const sentry_tags = {
      environment: this.app.environment,
      cli: this.app.version,
      node_runtime: process.version,
      os: os.platform(),
      shell: this.child.config?.shell,
      user: sentry_user?.id || os.hostname(),
      'user-email': sentry_user?.email || os.hostname(),
    };

    Sentry.init({
      dsn: CLI_SENTRY_DSN,
      debug: false,
      environment: this.app.environment,
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
  }

  async updateSentryTransaction(error?: Error): Promise<void> {

    const docker_version = await docker(['version', '-f', 'json'], { stdout: false });
    const docker_info = JSON.parse(docker_version?.stdout as string);
    const updated_docker_info = Object.assign(docker_info, { Containers: await this.getRunningDockerContainers() });
    const config_directory_files = await this.getFilenamesFromDirectory();

    if (error) {
      error.stack = PromptUtils.strip_ascii_color_codes_from_string(error.stack);
    }

    const sentry_session_metadata = await {
      docker_info: updated_docker_info,
      linked_components: this.app.linkedComponents,
      command: this.child.id || this.child.name,
      environment: this.app.environment,
      config_dir_files: config_directory_files,
      config_file: path.join(this.app.config?.getConfigDir(), LocalPaths.CLI_CONFIG_FILENAME),
      cwd: process.cwd(),
      log_level: this.app.config?.log_level,
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
  }

  async endSentryTransaction(error?: Error): Promise<void> {
    if (this.app.environment === APP_ENV.TEST) return;

    await this.updateSentryTransaction(error);

    if (this.file_out) {
      await this.writeCommandHistoryToFileSystem();
    }

    if (this.sentry_out) {
      Sentry.getCurrentHub().getScope()?.getSpan()?.finish();
      Sentry.getCurrentHub().getScope()?.getTransaction()?.finish();
      if (error) {
        Sentry.withScope(scope => Sentry.captureException(error));
      }
    }
  }
  /*
  * Helper Functions
  */
  async setScopeExtra(key: string, value: any): Promise<void> {
    const update_scope = Sentry.getCurrentHub().getScope();
    update_scope?.setExtra(key, value);
  }

  async getRunningDockerContainers(): Promise<any[]> {
    const docker_command = await docker(['ps', '--format', '{{json .}}%%'], { stdout: false });
    const docker_stdout = (docker_command.stdout as string).split('%%')
      .map((str: string) => (str && str.length) ? JSON.parse(str) : undefined);

    return docker_stdout.filter(x => !!x).map((container: any) => ({ ...container, Labels: undefined }));
  }

  async getFilenamesFromDirectory(): Promise<any[]> {
    const path = this.app.config?.getConfigDir();
    const addr = fs.readdirSync(path, { withFileTypes: true });
    return addr.filter(f => f.isFile()).map(f => ({ name: f.name }));
  }

  async readCommandHistoryFromFileSystem(): Promise<any[]> {
    let command_history = [];
    if (fs.existsSync(this.sentry_history_file_path)) {
      command_history = await JSON.parse(fs.readFileSync(this.sentry_history_file_path).toString()) || [];
    }
    return command_history;
  }

  async writeCommandHistoryToFileSystem(): Promise<void> {
    const scope = Sentry.getCurrentHub()?.getScope();
    const remove_keys = new Set(['plugins', 'pjson', 'oauth_client_id', 'credentials', '_auth_result', 'Authorization']);

    let current_output = JSON.parse(JSON.stringify(scope as any, (key, value) => {
      return ((value && !remove_keys.has(key) && Object.keys(value).length)) ? value : undefined;
    }));

    if (current_output._span) {
      current_output = { ...current_output, _tags: undefined, _user: undefined };
    }

    if (!fs.existsSync(this.sentry_history_file_path)) {
      return fs.outputJsonSync(this.sentry_history_file_path, [current_output], { spaces: 2 });
    }

    const history = await JSON.parse(fs.readFileSync(this.sentry_history_file_path).toString());
    history.push(current_output);
    // min(defined maximum history length, current history length)
    const maximum_records = ~Math.min(5, history.length) + 1;
    fs.outputJsonSync(this.sentry_history_file_path, history.slice(maximum_records), { spaces: 2 });
  }


}