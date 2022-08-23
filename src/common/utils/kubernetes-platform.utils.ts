import { CliUx } from '@oclif/core';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import * as yaml from 'js-yaml';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import { ENVIRONMENT } from '../../app-config/config';
import { CreatePlatformInput } from '../../architect/platform/platform.utils';

const SERVICE_ACCOUNT_NAME = 'architect';
const SERVICE_ACCOUNT_SECRET_NAME = `${SERVICE_ACCOUNT_NAME}-token`;

export class KubernetesPlatformUtils {

  public static async configureKubernetesPlatform(
    flags: any, environment: string = ENVIRONMENT.PRODUCTION, kube_context: any
  ): Promise<CreatePlatformInput> {
    const default_config_directory = path.join(os.homedir(), '.config');
    const config_env = {
      XDG_CONFIG_HOME: environment === ENVIRONMENT.PRODUCTION
        ? process.env.XDG_CONFIG_HOME || default_config_directory
        : default_config_directory,
    };

    const kubeconfig_path = untildify(flags.kubeconfig);
    const kube_contents = (await fs.readFile(kubeconfig_path)).toString();
    const kube_config = yaml.load(kube_contents) as any;

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];

    /* We now support k8s v1.24+, but leaving here for future use
    const { stdout } = await execa('kubectl', [
      ...set_kubeconfig,
      'version', '--short=true']);

    const api_version = stdout.split('v').pop();
    if (api_version) {
      const [major_ver, minor_ver] = api_version.split('.').map(int => parseInt(int));

      if (major_ver >= 1 && minor_ver >= 24) {
        throw new ArchitectError('Architect currently does not support Kubernetes v1.24 or higher.');
      }
    }
    */

    // Check for existing Service Account
    let use_existing_sa;
    try {
      await execa('kubectl', [
        ...set_kubeconfig,
        'get', 'sa', SERVICE_ACCOUNT_NAME,
        '-o', 'json',
      ]);
      use_existing_sa = true;
    } catch {
      use_existing_sa = false;
    }

    // Make sure the existing SA uses cluster-admin role binding
    if (use_existing_sa) {
      const { stdout } = await execa('kubectl', [
        ...set_kubeconfig,
        'get', 'clusterrolebinding',
        '-o', 'json',
      ]);
      const clusterrolebindings = JSON.parse(stdout);
      const sa_binding = clusterrolebindings.items.find(
        (rolebinding: any) =>
          rolebinding.subjects &&
          rolebinding.subjects.length > 0 &&
          rolebinding.subjects.find(
            (subject: any) =>
              subject.kind === 'ServiceAccount' &&
              subject.name === SERVICE_ACCOUNT_NAME
          )
      );

      if (!sa_binding) {
        await execa('kubectl', [
          ...set_kubeconfig,
          'create',
          'clusterrolebinding',
          `${SERVICE_ACCOUNT_NAME}-cluster-admin`,
          '--clusterrole',
          'cluster-admin',
          '--serviceaccount',
          `default:${SERVICE_ACCOUNT_NAME}`,
        ]);
      }
    }

    if (!use_existing_sa) {
      CliUx.ux.action.start('Creating the service account');
      // Create the service account
      await execa('kubectl', [
        ...set_kubeconfig,
        'create', 'sa', SERVICE_ACCOUNT_NAME,
      ], { env: config_env });

      // Bind the service account to the cluster-admin role
      await execa('kubectl', [
        ...set_kubeconfig,
        'create',
        'clusterrolebinding',
        `${SERVICE_ACCOUNT_NAME}-cluster-admin`,
        '--clusterrole',
        'cluster-admin',
        '--serviceaccount',
        `default:${SERVICE_ACCOUNT_NAME}`,
      ], { env: config_env });
      CliUx.ux.action.stop();
    }

    CliUx.ux.action.start('Loading kubernetes configuration info');

    // Retrieve cluster host and ca certificate
    const cluster = kube_config.clusters.find((cluster: any) => cluster.name === kube_context.context.cluster);
    let cluster_ca_cert: string;
    if ('certificate-authority-data' in cluster.cluster) {
      const ca_cert_buffer = Buffer.from(cluster.cluster['certificate-authority-data'], 'base64');
      cluster_ca_cert = ca_cert_buffer.toString('utf-8');
    } else {
      cluster_ca_cert = await fs.readFile(untildify(cluster.cluster['certificate-authority']), 'utf-8');
    }
    const cluster_host = cluster.cluster.server;

    // Support kubernetes 1.24+ by manually creating service account token
    const secret_yml = `
apiVersion: v1
kind: Secret
metadata:
  name: ${SERVICE_ACCOUNT_SECRET_NAME}
  annotations:
    kubernetes.io/service-account.name: ${SERVICE_ACCOUNT_NAME}
type: kubernetes.io/service-account-token
`;
    await execa('kubectl', [
      ...set_kubeconfig,
      'apply', '-f', '-',
    ], { input: secret_yml, env: config_env });

    const secret_res = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'secrets', SERVICE_ACCOUNT_SECRET_NAME,
      '-o', 'json',
    ], { env: config_env });
    const sa_token_buffer = Buffer.from(JSON.parse(secret_res.stdout).data.token, 'base64');
    const service_token = sa_token_buffer.toString('utf-8');

    CliUx.ux.action.stop();

    try {
      const nodes = await execa('kubectl', [
        'get', 'nodes',
        '-o', 'json',
        `--request-timeout='2s'`,
      ]);

      if (JSON.parse(nodes.stdout).items.length === 0) {
        console.log(chalk.yellow('Warning: The cluster does not have any running nodes.'));
      }
      // eslint-disable-next-line no-empty
    } catch (err) { }
    CliUx.ux.action.stop();

    return {
      description: cluster_host,
      type: 'KUBERNETES',
      credentials: {
        kind: 'KUBERNETES',
        host: cluster_host,
        service_token,
        cluster_ca_cert,
      },
    };
  }
}
