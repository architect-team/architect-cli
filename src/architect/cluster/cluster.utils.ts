import { Flags } from '@oclif/core';
import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import execa from 'execa';
import inquirer from 'inquirer';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import Account from '../account/account.entity';
import Cluster from './cluster.entity';
import semver, { SemVer } from 'semver';

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

export const MIN_CLUSTER_VERSION = { 'major': 1, 'minor': 22, 'gitVersion': '1.22.0' };

export default class ClusterUtils {
  static flags = {
    cluster: Flags.string({
      description: 'Architect cluster',
      env: 'ARCHITECT_CLUSTER',
      parse: async value => value.toLowerCase(),
      sensitive: false,
      exclusive: ['platform'],
    }),
    platform: Flags.string({
      description: 'Architect cluster',
      env: 'ARCHITECT_PLATFORM',
      parse: async value => value.toLowerCase(),
      sensitive: false,
      exclusive: ['cluster'],
      deprecated: {
        to: 'cluster',
      },
    }),
  };

  static async getCluster(api: AxiosInstance, account: Account, cluster_name?: string): Promise<Cluster> {
    const cluster_environment_variable_set = process.env.ARCHITECT_CLUSTER === cluster_name && process.env.ARCHITECT_CLUSTER;
    const platform_environment_variable_set = process.env.ARCHITECT_PLATFORM === cluster_name && process.env.ARCHITECT_PLATFORM;

    if (cluster_environment_variable_set || platform_environment_variable_set) {
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
          ciMessage: '--cluster flag is required in CI pipelines or by setting ARCHITECT_CLUSTER env',
        },
      ]);
      cluster = answers.cluster;
    }
    return cluster;
  }

  private static async getClientVersion() {
    const { stdout } = await execa('kubectl', ['version', '--client', '--output', 'json']);
    const { clientVersion } = JSON.parse(stdout);
    return clientVersion;
  }

  public static async checkClientVersion(): Promise<void> {
    const client_version = await this.getClientVersion();
    const client_semver = semver.coerce(client_version.gitVersion);
    if (!client_semver) {
      throw new ArchitectError(`Failed to translate Kubernetes cluster version ${client_version.gitVersion}.`);
    }

    const min_cluster_semver = semver.coerce(MIN_CLUSTER_VERSION.gitVersion) as SemVer;
    if (semver.lt(client_semver.version, min_cluster_semver.version)) {
      throw new ArchitectError(`Currently, we only support Kubernetes clusters on version ${MIN_CLUSTER_VERSION.major}.${MIN_CLUSTER_VERSION.minor} or greater. Your cluster is currently on version ${client_semver.version} which is below the minimum required version. Please upgrade your cluster before registering it with Architect.`);
    }
  }
}
