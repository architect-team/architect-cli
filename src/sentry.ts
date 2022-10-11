import { Dedupe, ExtraErrorData, RewriteFrames, Transaction } from '@sentry/integrations';
import * as Sentry from '@sentry/node';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ENVIRONMENT } from './app-config/config';
import User from './architect/user/user.entity';
import type BaseCommand from './base-command';
import { docker } from './common/docker/cmd';
import PromptUtils from './common/utils/prompt-utils';
import LocalPaths from './paths';

const CLI_SENTRY_DSN = 'https://272fd53f577f4729b014701d74fe6c53@o298191.ingest.sentry.io/6465948';

export default class SentryService {
  command: BaseCommand;
  file_out?: boolean;
  sentry_history_file_path?: string;

  constructor(command: BaseCommand) {
    this.command = command;
    this.initSentry();
  }

  private async ignoreTryCatch(fn: () => Promise<void>, debug_message: string) {
    try {
      await fn();
    } catch {
      this.command.debug(debug_message);
    }
  }

  initSentry(): void {
    this.ignoreTryCatch(async () => {
      Sentry.init({
        enabled: process.env.TEST !== '1' && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== ENVIRONMENT.PREVIEW,
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
          if (event.req?.data?.token) {
            event.req.data.token = '*'.repeat(20);
          }
          return event;
        },
        beforeBreadcrumb(breadcrumb: any) {
          if (breadcrumb.category === 'console') {
            breadcrumb.message = PromptUtils.strip_ascii_color_codes_from_string(breadcrumb.message);
          }
          return breadcrumb;
        },
      });
    }, 'SENTRY: an error occurred creating a new instance of SentryService');
  }

  private async getUser(): Promise<User | undefined> {
    try {
      const user = await this.command.app.auth.checkLogin();
      if (user) {
        return user;
      }
    } catch {
      this.command.debug("SENTRY: Unable to load user");
    }
  }

  async startSentryTransaction(): Promise<void> {
    this.ignoreTryCatch(async () => {
      this.file_out = this.command.app.config.environment !== ENVIRONMENT.TEST && this.command.app.config.environment !== ENVIRONMENT.PREVIEW;
      this.sentry_history_file_path = path.join(this.command.app.config?.getConfigDir(), LocalPaths.SENTRY_FILENAME);

      const sentry_user = await this.getUser();

      const sentry_tags = {
        environment: this.command.app.config.environment,
        cli: this.command.app.version,
        node_runtime: process.version,
        os: os.platform(),
        shell: this.command.config.shell,
        user: sentry_user?.id,
        'user-email': sentry_user?.email,
      };

      const transaction = Sentry.startTransaction({
        op: this.command.id,
        status: 'ok',
        tags: sentry_tags,
        name: this.command.constructor.name,
      });

      return Sentry.configureScope(scope => {
        scope.setSpan(transaction);
        if (sentry_user) {
          scope.setUser(sentry_user);
        }
        scope.setTags(sentry_tags);
      });
    }, 'SENTRY: an error occurred starting transaction');
  }

  async updateSentryTransaction(error?: any): Promise<void> {
    try {
      // Only query for docker containers if there is an error to improve performance of cmds
      const updated_docker_info = error ? await this.getRunningDockerContainers() : [];
      const config_directory_files = error ? await this.getFilenamesFromDirectory() : [];

      if (error) {
        error.stack = PromptUtils.strip_ascii_color_codes_from_string(error.stack);
      }

      const sentry_session_metadata = await {
        docker_info: updated_docker_info,
        linked_components: this.command.app.linkedComponents,
        command: this.command.constructor.name,
        environment: this.command.app.config.environment,
        config_dir_files: config_directory_files,
        config_file: path.join(this.command.app.config?.getConfigDir() ?? '', LocalPaths.CLI_CONFIG_FILENAME),
        cwd: process.cwd(),
        log_level: this.command.app.config?.log_level,
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
      this.command.debug("SENTRY: Unable to attach metadata to the current transaction");
    }
  }

  private async filterNonSensitiveSentryMetadata(non_sensitive: Set<string>, metadata: any): Promise<any> {
    return Object.entries(metadata)
      .filter((value) => !!value[1] && non_sensitive.has(value[0]))
      .map(key => ({ [key[0]]: key[1] }));
  }

  async endSentryTransaction(error?: any): Promise<void> {
    await this.ignoreTryCatch(async () => {
      if (this.command.app.config.environment === ENVIRONMENT.TEST) {
        Sentry.close(0);
        return;
      }

      const command_class = this.command.getClass();
      const { args, flags } = await this.command.parse(command_class);
      const non_sensitive = new Set([
        ...Object.entries(command_class.flags || {}).filter(([_, value]) => value.sensitive === false).map(([key, _]) => key),
        ...Object.entries(command_class.args || {}).filter(([_, value]) => (value as any).sensitive === false).map(([_, value]) => (value as any).name),
      ]);

      try {
        const filtered_sentry_args = await this.filterNonSensitiveSentryMetadata(non_sensitive, args);
        const filtered_sentry_flags = await this.filterNonSensitiveSentryMetadata(non_sensitive, flags);

        await this.setScopeExtra('command_args', filtered_sentry_args);
        await this.setScopeExtra('command_flags', filtered_sentry_flags);
      } catch (err) {
        this.command.debug("Unable to add extra sentry metadata");
      }

      await this.updateSentryTransaction(error);

      if (this.file_out) {
        await this.writeCommandHistoryToFileSystem();
      }

      // If error.track is undefined, assume it's true - only skip capturing exceptions if track is explicitly set to false
      if (error && error.track !== false) {
        Sentry.withScope(async scope => {
          Sentry.captureException(error, scope);
        });
      }
      Sentry.getCurrentHub().getScope()?.getSpan()?.finish();
      Sentry.getCurrentHub().getScope()?.getTransaction()?.finish();
      await Sentry.getCurrentHub().getClient()?.close();
    }, 'SENTRY: Error occurred on ending transaction');
  }

  /*
  * Helper Functions
  */
  async setScopeExtra(key: string, value: any): Promise<void> {
    try {
      const update_scope = Sentry.getCurrentHub().getScope();
      update_scope?.setExtra(key, value);
    } catch {
      this.command.debug("SENTRY: Unable to add extra metadata element to the current transaction");
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
      this.command.debug("SENTRY: Unable to retrieve running docker container metadata");
      return [];
    }
  }

  async getFilenamesFromDirectory(): Promise<any[]> {
    try {
      const path = this.command.app.config.getConfigDir();
      const addr = fs.readdirSync(path ?? '', { withFileTypes: true });
      return addr.filter(f => f.isFile()).map(f => ({ name: f.name })) || [];
    } catch {
      this.command.debug("SENTRY: Unable to read list of file names from the architect config directory");
      return [];
    }
  }

  async readCommandHistoryFromFileSystem(): Promise<any[]> {
    try {
      if (fs.existsSync(this.sentry_history_file_path ?? '')) {
        return await JSON.parse(fs.readFileSync(this.sentry_history_file_path ?? '').toString()) || [];
      }
    } catch {
      this.command.debug("SENTRY: Unable to read command history file from the architect config directory");
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
      this.command.debug("SENTRY: Unable to write command history file to the architect config directory");
    }
  }
}
