import { cli } from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { CreatePlatformInput } from '../../commands/environments/create';
import { EnvironmentNameValidator } from './validation';

export class KubernetesPlatformUtils {

  public static async configure_kubernetes_platform(
    args: any,
    flags: any,
    account: { id: string; name: string },
  ): Promise<CreatePlatformInput> {

    let kubeconfig: any;
    const kubeconfig_path = untildify(flags.kubeconfig);
    try {
      kubeconfig = await fs.readFile(path.resolve(kubeconfig_path), 'utf-8');
    } catch {
      throw new Error(`No kubeconfig found at ${kubeconfig_path}`);
    }

    try {
      kubeconfig = yaml.safeLoad(kubeconfig);
    } catch {
      throw new Error('Invalid kubeconfig format. Did you provide the correct path?');
    }

    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];

    // Get original kubernetes current-context
    const { stdout: original_kubecontext } = await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'current-context',
    ]);

    const new_platform_answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        when: !args.name,
        message: 'What would you like to name the new platform?',
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: () => `${account.name}-kubernetes`,
      },
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
      {
        type: 'input',
        name: 'service_account_name',
        message: 'What would you like to name the service account for your environment?',
        default: 'architect',
      },
      {
        when: async (answers: any) => {
          try {
            await execa('kubectl', [
              ...set_kubeconfig,
              'get', 'sa', answers.service_account_name,
              '-o', 'json',
            ]);
            return true;
          } catch {
            return false;
          }
        },
        type: 'confirm',
        name: 'use_existing_sa',
        message: 'A service account with that name already exists. Would you like to use it for this environment?',
      },
    ]);

    if (new_platform_answers.use_existing_sa === false) {
      throw new Error('Please select another service account name');
    }

    // Make sure the existing SA uses cluster-admin role binding
    if (new_platform_answers.use_existing_sa) {
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
              subject.name === new_platform_answers.service_account_name
          )
      );

      if (!sa_binding) {
        await execa('kubectl', [
          ...set_kubeconfig,
          'create',
          'clusterrolebinding',
          `${new_platform_answers.service_account_name}-cluster-admin`,
          '--clusterrole',
          'cluster-admin',
          '--serviceaccount',
          `default:${new_platform_answers.service_account_name}`,
        ]);
      }
    }

    if (!new_platform_answers.use_existing_sa) {
      cli.action.start('Creating the service account');
      await KubernetesPlatformUtils.createKubernetesServiceAccount(untildify(kubeconfig_path), new_platform_answers.service_account_name);
      cli.action.stop();
    }

    cli.action.start('Loading kubernetes configuration info');

    // Retrieve cluster host and ca certificate
    const cluster = kubeconfig.clusters.find((cluster: any) => cluster.name === new_platform_answers.context.context.cluster);
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
      'get', 'sa', new_platform_answers.service_account_name,
      '-o', 'json',
    ]);
    const sa_secret_name = JSON.parse(saRes.stdout).secrets[0].name;
    const secret_res = await execa('kubectl', [
      ...set_kubeconfig,
      'get', 'secrets', sa_secret_name,
      '-o', 'json',
    ]);
    const sa_token_buffer = Buffer.from(JSON.parse(secret_res.stdout).data.token, 'base64');
    const service_token = sa_token_buffer.toString('utf-8');

    cli.action.stop();

    await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'set',
      'current-context', original_kubecontext,
    ]);
    cli.action.stop();

    return {
      name: args.name || new_platform_answers.name,
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

  public static async createKubernetesServiceAccount(kubeconfig_path: string, sa_name: string) {
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
