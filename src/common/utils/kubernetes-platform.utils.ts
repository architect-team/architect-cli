import { CliUx } from '@oclif/core';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { ArchitectError } from '../../';
import { CreatePlatformInput } from '../../architect/platform/platform.utils';

const SERVICE_ACCOUNT_NAME = 'architect';

export class KubernetesPlatformUtils {

  public static async configureKubernetesPlatform(
    flags: any,
  ): Promise<CreatePlatformInput> {

    let kubeconfig: any;
    const kubeconfig_path = untildify(flags.kubeconfig);
    try {
      kubeconfig = await fs.readFile(path.resolve(kubeconfig_path), 'utf-8');
    } catch {
      throw new Error(`No kubeconfig found at ${kubeconfig_path}`);
    }

    try {
      kubeconfig = yaml.load(kubeconfig);
    } catch {
      throw new Error('Invalid kubeconfig format. Did you provide the correct path?');
    }

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];

    // Get original kubernetes current-context
    const { stdout: original_kubecontext } = await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'current-context',
    ]);

    let kube_context: any;
    if (flags['auto-approve']) {
      if (kubeconfig.contexts.length === 1) {
        kube_context = kubeconfig.contexts[0];
      } else if (kubeconfig.contexts.length > 1) {
        throw new ArchitectError('Multiple kubeconfig contexts detected');
      } else {
        throw new ArchitectError('No kubeconfig contexts detected');
      }
    } else {
      const new_platform_answers: any = await inquirer.prompt([
        {
          type: 'list',
          name: 'context',
          message: 'Which kube context points to your cluster?',
          choices: kubeconfig.contexts.map((ctx: any) => ctx.name),
          filter: async value => {
            // Set the context to the one the user selected
            await execa('kubectl', [
              ...set_kubeconfig,
              'config', 'set',
              'current-context', value,
            ]);

            // Set the context value to the matching object from the kubeconfig
            return kubeconfig.contexts.find((ctx: any) => ctx.name === value);
          },
        },
      ]);
      kube_context = new_platform_answers.context;
    }

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
      await KubernetesPlatformUtils.createKubernetesServiceAccount(untildify(kubeconfig_path), SERVICE_ACCOUNT_NAME);
      CliUx.ux.action.stop();
    }

    CliUx.ux.action.start('Loading kubernetes configuration info');

    // Retrieve cluster host and ca certificate
    const cluster = kubeconfig.clusters.find((cluster: any) => cluster.name === kube_context.context.cluster);
    let cluster_ca_cert: string;
    if ('certificate-authority-data' in cluster.cluster) {
      const ca_cert_buffer = Buffer.from(cluster.cluster['certificate-authority-data'], 'base64');
      cluster_ca_cert = ca_cert_buffer.toString('utf-8');
    } else {
      cluster_ca_cert = await fs.readFile(untildify(cluster.cluster['certificate-authority']), 'utf-8');
    }
    const cluster_host = cluster.cluster.server;

    // Retrieve service account token
    const saRes = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'sa', SERVICE_ACCOUNT_NAME,
      '-o', 'json',
    ]);

    const secrets = JSON.parse(saRes.stdout).secrets;
    if (!secrets) {
      throw new Error('Unable to retrieve service account secret');
    }
    const sa_secret_name = secrets[0].name;
    const secret_res = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'secrets', sa_secret_name,
      '-o', 'json',
    ]);
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

    await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'set',
      'current-context', original_kubecontext,
    ]);
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

  public static async createKubernetesServiceAccount(kubeconfig_path: string, sa_name: string): Promise<void> {
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path, '--namespace', 'default'];

    // Create the service account
    await execa('kubectl', [
      ...set_kubeconfig,
      'create', 'sa', sa_name,
    ]);

    // Bind the service account to the cluster-admin role
    await execa('kubectl', [
      ...set_kubeconfig,
      'create',
      'clusterrolebinding',
      `${sa_name}-cluster-admin`,
      '--clusterrole',
      'cluster-admin',
      '--serviceaccount',
      `default:${sa_name}`,
    ]);
  }
}
