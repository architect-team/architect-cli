import AppService from '../../app-config/service';
import Account from '../account/account.entity';
import ClusterUtils from '../cluster/cluster.utils';
import { EnvironmentUtils, GetEnvironmentOptions } from '../environment/environment.utils';

export interface Secret {
  scope: string;
  key: string;
  value: string | number | boolean;
}

export interface SecretOptions {
  cluster_name?: string;
  environment_name?: string;
}

export default class SecretUtils {
  static async getSecrets(app: AppService, account: Account, options?: SecretOptions, inherited?: boolean) : Promise<Secret[]> {
    let secrets: Secret[] = [];
    if (options?.environment_name) {
      const get_environment_options: GetEnvironmentOptions = { environment_name: options.environment_name };
      const environment = await EnvironmentUtils.getEnvironment(app.api, account, get_environment_options);
      secrets = (await app.api.get(`environments/${environment.id}/secrets/values`, { params: { inherited: true } })).data;
    } else if (options?.cluster_name) {
      const cluster = await ClusterUtils.getCluster(app.api, account, options?.cluster_name);
      secrets = (await app.api.get(`clusters/${cluster.id}/secrets/values`, { params: { inherited } })).data;
    } else {
      secrets = (await app.api.get(`accounts/${account.id}/secrets/values`)).data;
    }

    return secrets;
  }

  static async batchUpdateSecrets(app: AppService, secrets: Secret[], account: Account, options?: SecretOptions): Promise<void> {
    if (options?.environment_name) {
      const get_environment_options: GetEnvironmentOptions = { environment_name: options.environment_name };
      const environment = await EnvironmentUtils.getEnvironment(app.api, account, get_environment_options);
      await app.api.post(`/environments/${environment.id}/secrets/batch`, secrets);
    } else if (options?.cluster_name) {
      const cluster = await ClusterUtils.getCluster(app.api, account, options?.cluster_name);
      await app.api.post(`/clusters/${cluster.id}/secrets/batch`, secrets);
    } else {
      await app.api.post(`/accounts/${account.id}/secrets/batch`, secrets);
    }
  }
}
