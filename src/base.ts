import Command from '@oclif/command';
import Config from '@oclif/config';
import Listr from 'listr';
import { AppConfig } from './app-config';
import ArchitectClient from './common/client';

export default abstract class ArchitectCommand extends Command {
  static async tasks(this: any, argv?: string[], opts?: Config.LoadOptions): Promise<Listr.ListrTask[]> {
    if (!argv) argv = process.argv.slice(2);
    const config = await Config.load(opts || module.parent && module.parent.parent && module.parent.parent.filename || __dirname);
    const cmd = new this(argv, config);
    return cmd._tasks(argv);
  }
  protected static app_config: AppConfig;
  protected static architect: ArchitectClient;

  app_config!: AppConfig;
  architect!: ArchitectClient;

  async init() {
    if (!ArchitectCommand.app_config) {
      ArchitectCommand.app_config = new AppConfig();
    }
    this.app_config = ArchitectCommand.app_config;

    if (!ArchitectCommand.architect) {
      ArchitectCommand.architect = new ArchitectClient(this.app_config);
      try {
        await ArchitectCommand.architect.getToken();
      } catch {
        // Try to refresh token if expired
      }
    }
    this.architect = ArchitectCommand.architect;
  }

  async catch(err: any) {
    if (err.oclif && err.oclif.exit === 0) return;
    if (err.response && err.response.data) {
      this.styled_json(err.response.data);
    }
    if (this.app_config && this.app_config.debug) {
      throw err;
    } else {
      this.error(err.message || err);
    }
  }

  async tasks(): Promise<Listr.ListrTask[]> { throw Error('Not implemented'); }

  async _tasks(): Promise<Listr.ListrTask[] | undefined> {
    let err: Error | undefined;
    try {
      // remove redirected env var to allow subsessions to run autoupdated client
      delete process.env[this.config.scopedEnvVarKey('REDIRECTED')];

      await this.init();
      return await this.tasks();
    } catch (e) {
      err = e;
      await this.catch(e);
    } finally {
      await this.finally(err);
    }
  }

  styled_json(obj: object) {
    const json = JSON.stringify(obj, null, 2);
    this.log(json);
  }
}
