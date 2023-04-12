import { Flags } from '@oclif/core';
import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import execa from 'execa';
import inquirer from 'inquirer';
import semver, { SemVer } from 'semver';
import untildify from 'untildify';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import Account from '../account/account.entity';
import { Paginate } from '../types';
import Cluster from './cluster.entity';

export interface CreateClusterInput {
  type: string;
  description: string;
  credentials?: ClusterCredentials;
}

export type ClusterCredentials = KubernetesClusterCredentials;

export interface KubernetesClusterCredentials {
  kind: 'KUBERNETES' | 'AGENT';

  host: string;
  cluster_ca_cert?: string;
  service_token?: string;
}

export const MIN_CLUSTER_SEMVER: SemVer = new SemVer('1.22.0');

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
      const { data } = await api.get<Paginate<Cluster>>(`/accounts/${account.id}/clusters`, { params: { limit: 1 } });
      if (!data.total) {
        throw new Error(`No configured clusters. Run 'architect cluster:create -a ${account.name}'.`);
      }

      if (data.total === 1) {
        return data.rows[0];
      }

      const answers: { cluster: Cluster } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'cluster',
          message: 'Select a cluster',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await api.get<Paginate<Cluster>>(`/accounts/${account.id}/clusters`, { params: { q: input, limit: 10 } });
            const clusters = data.rows;
            return clusters.map((c) => ({ name: c.name, value: c }));
          },
          ciMessage: '--cluster flag is required in CI pipelines or by setting ARCHITECT_CLUSTER env',
        },
      ]);
      cluster = answers.cluster;
    }
    return cluster;
  }

  private static async getServerVersion(kubeconfig_path: string): Promise<string | undefined> {
    try {
      const { stdout } = await execa('kubectl', ['version', '--kubeconfig', kubeconfig_path, '--output', 'json']);
      const { serverVersion } = JSON.parse(stdout);
      return serverVersion.gitVersion;
    } catch {
      //
      return undefined;
    }
  }

  public static async checkServerVersion(kubeconfig: string): Promise<void> {
    const kubeconfig_path = untildify(kubeconfig);
    const client_git_version = await this.getServerVersion(kubeconfig_path);
    const client_semver = semver.coerce(client_git_version);
    if (!client_semver) {
      throw new ArchitectError('We are unable to read the version of your cluster.\nPlease make sure your cluster is reachable using kubectl before attempting to register it.\nIf you continue to experience issues please contact Architect support. https://support.architect.io/');
    }

    if (semver.lt(client_semver.version, MIN_CLUSTER_SEMVER.version)) {
      throw new ArchitectError(`Currently, we only support Kubernetes clusters on version ${MIN_CLUSTER_SEMVER.version} or greater. Your cluster is currently on version ${client_semver.version} which is below the minimum required version. Please upgrade your cluster before registering it with Architect.`);
    }
  }

  public static async checkClusterNodes(kubeconfig_path: string): Promise<void> {
    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path)];
    const { stderr } = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'nodes',
    ]);
    if (stderr === 'No resources found') {
      throw new Error('No nodes were detected for the Kubernetes cluster. Please add nodes to the cluster in order for your applications to run.');
    }
  }
}
