import { Flags } from '@oclif/core';
import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Account from '../account/account.entity';
import Cluster from './cluster.entity';

export interface CreateClusterInput {
  type: string;
  description: string;
  credentials?: ClusterCredentials;
}

export type ClusterCredentials = KubernetesClusterCredentials;

export interface KubernetesClusterCredentials {
  kind: 'KUBERNETES';

  host: string;
  cluster_ca_cert: string;
  service_token: string;
}

export default class ClusterUtils {
  static flags = {
    cluster: Flags.string({
      description: 'Architect cluster',
      env: 'ARCHITECT_CLUSTER',
      parse: async value => value.toLowerCase(),
      sensitive: false,
    }),
  };

  static async getCluster(api: AxiosInstance, account: Account, cluster_name?: string): Promise<Cluster> {
    if (process.env.ARCHITECT_CLUSTER === cluster_name && process.env.ARCHITECT_CLUSTER) {
      console.log(chalk.blue(`Using cluster from environment variables: `) + cluster_name);
    }

    let cluster: Cluster;
    if (cluster_name) {
      cluster = (await api.get(`/accounts/${account.id}/clusters/${cluster_name}`)).data;
    } else {
      // eslint-disable-next-line unicorn/prefer-module
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

      // inquirer-autocomplete-prompt doesn't catch exceptions in source...
      const { data } = await api.get(`/accounts/${account.id}/clusters`, { params: { limit: 1 } });
      if (!data.total) {
        throw new Error(`No configured clusters. Run 'architect cluster:create -a ${account.name}'.`);
      }

      const answers: { cluster: Cluster } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'cluster',
          message: 'Select a cluster',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await api.get(`/accounts/${account.id}/clusters`, { params: { q: input, limit: 10 } });
            const clusters = data.rows as Cluster[];
            return clusters.map((c) => ({ name: c.name, value: c }));
          },
        },
      ]);
      cluster = answers.cluster;
    }
    return cluster;
  }
}
