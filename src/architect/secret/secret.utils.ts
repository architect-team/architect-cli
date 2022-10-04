import AppService from '../../app-config/service';
import Account from '../account/account.entity';
import { EnvironmentUtils } from '../environment/environment.utils';
import PlatformUtils from '../platform/platform.utils';

export interface Secret {
  scope: string;
  key: string;
  value: string | number | boolean;
}

export default class SecretUtils {
  
  static async getSecrets(app: AppService, account: Account, platform_name?: string, environment_name?: string, inherited?: boolean) : Promise<Secret[]>{
    let secrets: Secret[] = [];
    if (environment_name) {
      const environment = await EnvironmentUtils.getEnvironment(app.api, account, environment_name);
      secrets = (await app.api.get(`environments/${environment.id}/secrets/values`, { params: { inherited: true } })).data;
    } else if (platform_name) {
      const platform = await PlatformUtils.getPlatform(app.api, account, platform_name);
      secrets = (await app.api.get(`platforms/${platform.id}/secrets/values`, { params: { inherited } })).data;
    } else {
      secrets = (await app.api.get(`accounts/${account.id}/secrets/values`)).data;
    }

    return secrets;
  }

  static async batchUpdateSecrets(app: AppService, secrets: Secret[], account: Account, platform_name?: string, environment_name?: string): Promise<void> {
    if (environment_name) {
      const environment = await EnvironmentUtils.getEnvironment(app.api, account, environment_name);
      await app.api.post(`/environments/${environment.id}/secrets/batch`, secrets);
    } else if (platform_name) {
      const platform = await PlatformUtils.getPlatform(app.api, account, platform_name);
      await app.api.post(`/platforms/${platform.id}/secrets/batch`, secrets);
    } else {
      await app.api.post(`/accounts/${account.id}/secrets/batch`, secrets);
    }
  }
}
