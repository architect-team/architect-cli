import AppService from '../../app-config/service';
import Account from '../account/account.entity';
import { EnvironmentUtils } from '../environment/environment.utils';

export interface Secret {
  scope: string;
  key: string;
  value: string | number | boolean;
}

export default class SecretUtils {
  
  static async getSecrets(app: AppService, account: Account, environment_name?: string, inherited?: boolean) : Promise<any[]>{
    let secrets = [];
    if (!environment_name) {
      secrets = (await app.api.get(`accounts/${account.id}/secrets/values`)).data;
    } else {
      const environment = await EnvironmentUtils.getEnvironment(app.api, account, environment_name);
      if (inherited) {
        secrets = (await app.api.get(`environments/${environment.id}/secrets/values`, { params: { inherited: true } })).data;
      } else {
        secrets = (await app.api.get(`environments/${environment.id}/secrets/values`)).data;
      }
    }
    return secrets;
  }

  static async batchUpdateSecrets(app: AppService, secrets: Secret[], account: Account, environment_name?: string): Promise<void> {
    if (environment_name) {
      const environment = await EnvironmentUtils.getEnvironment(app.api, account, environment_name);
      await app.api.post(`/environments/${environment.id}/secrets/batch`, secrets);
    } else {
      await app.api.post(`/accounts/${account.id}/secrets/batch`, secrets);
    }
  }
}
