import {flags} from '@oclif/command';
import untildify from 'untildify';
import fs from 'fs-extra';
import path from 'path';
import execa from 'execa';
import yaml from 'js-yaml';
import inquirer from 'inquirer';
import cli from 'cli-ux';
import Command from '../../base-command';
import { EnvironmentNameValidator } from '../../common/utils/validation';
import { readIfFile } from '../../common/utils/file';

interface CreateEnvironmentInput {
  name: string;
  namespace: string;
  type: string;
  host: string;
  service_token: string;
  cluster_ca_certificate: string;
  config: string;
}

export default class EnvironmentCreate extends Command {
  static aliases = ['environment:create', 'envs:create', 'env:create'];
  static description = 'Register a new environment with Architect Cloud';

  static args = [{
    name: 'name',
    description: 'Name to give the environment',
    parse: (value: string) => value.toLowerCase(),
  }];

  static flags = {
    ...Command.flags,
    namespace: flags.string({ char: 'n' }),
    type: flags.string({ char: 't', options: ['kubernetes'], default: 'kubernetes' }),
    host: flags.string({ char: 'h' }),
    kubeconfig: flags.string({ char: 'k', default: '~/.kube/config', exclusive: ['service_token', 'cluster_ca_certificate', 'host'] }),
    service_token: flags.string({ description: 'Service token', env: 'ARCHITECT_SERVICE_TOKEN' }),
    cluster_ca_certificate: flags.string({ description: 'File path of cluster_ca_certificate', env: 'ARCHITECT_CLUSTER_CA_CERTIFICATE' }),
    config_file: flags.string({ char: 'c' }),
  };

  private async createArchitectEnvironment(data: CreateEnvironmentInput): Promise<any> {
    const { data: environment } = await this.app.api.post('/environments', data);
    return environment;
  }

  private async createKubernetesServiceAccount(kubeconfig_path: string, sa_name: string) {
    const set_kubeconfig = ['--kubeconfig', kubeconfig_path];

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

  private async runKubernetes() {
    const { args, flags } = this.parse(EnvironmentCreate);

    let kubeconfig: any;
    try {
      flags.kubeconfig = untildify(flags.kubeconfig!);
      kubeconfig = await fs.readFile(path.resolve(flags.kubeconfig), 'utf-8');
    } catch {
      throw new Error(`No kubeconfig found at ${flags.kubeconfig}`);
    }

    try {
      kubeconfig = yaml.safeLoad(kubeconfig);
    } catch {
      throw new Error('Invalid kubeconfig format. Did you provide the correct path?');
    }

    const set_kubeconfig = ['--kubeconfig', untildify(flags.kubeconfig)];

    // Get original kubernetes current-context
    const { stdout: original_kubecontext } = await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'current-context',
    ]);

    // Prompt user for required inputs
    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What would you like to name your new environment?',
        when: !args.name,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: flags.namespace || '',
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
      {
        when: answers => !flags.namespace && answers.use_existing_sa !== false,
        type: 'input',
        name: 'namespace',
        message: 'What namespace should the environment deploy resources to?',
        filter: value => value.toLowerCase(),
        validate: value => {
          if (EnvironmentNameValidator.test(value)) return true;
          return `Namespace must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
        },
        default: args.name || '',
      },
    ]);

    if (answers.use_existing_sa === false) {
      throw new Error('Please select another service account name');
    }

    // Make sure the existing SA uses cluster-admin role binding
    if (answers.use_existing_sa) {
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
              subject.name === answers.service_account_name
          )
      );

      if (!sa_binding) {
        await execa('kubectl', [
          ...set_kubeconfig,
          'create',
          'clusterrolebinding',
          `${answers.service_account_name}-cluster-admin`,
          '--clusterrole',
          'cluster-admin',
          '--serviceaccount',
          `default:${answers.service_account_name}`,
        ]);
      }

      if (!answers.use_existing_sa) {
        cli.action.start('Creating the service account');
        await this.createKubernetesServiceAccount(untildify(flags.kubeconfig), answers.service_account_name);
        cli.action.stop();
      }

      cli.action.start('Registering environment with Architect');

      // Retrieve cluster host and ca certificate
      const cluster = kubeconfig.clusters.find((cluster: any) => cluster.name === answers.context.context.cluster);
      let cluster_ca_certificate: string;
      if ('certificate-authority-data' in cluster.cluster) {
        const ca_cert_buffer = Buffer.from(cluster.cluster['certificate-authority-data'], 'base64');
        cluster_ca_certificate = ca_cert_buffer.toString('utf-8');
      } else {
        cluster_ca_certificate = await fs.readFile(untildify(cluster.cluster['certificate-authority']), 'utf-8');
      }
      const cluster_host = cluster.cluster.server;

      // Retrieve service account token
      const saRes = await execa('kubectl', [
        ...set_kubeconfig,
        'get', 'sa', answers.service_account_name,
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

      const environment = await this.createArchitectEnvironment({
        name: args.name || answers.name,
        namespace: flags.namespace || answers.namespace,
        type: flags.type!,
        config: flags.config_file ? await fs.readJSON(untildify((flags.config_file))) : undefined,
        host: cluster_host,
        service_token,
        cluster_ca_certificate,
      });

      cli.action.stop();

      cli.action.start('Registering environment with Architect');
      await execa('kubectl', [
        ...set_kubeconfig,
        'config', 'set',
        'current-context', original_kubecontext,
      ]);
      cli.action.stop();

      return environment;
    }
  }

  private async runGeneric() {
    const { args, flags } = this.parse(EnvironmentCreate);

    let answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'name',
      when: !args.name,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      },
    }, {
      type: 'input',
      name: 'namespace',
      when: !flags.namespace,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Namespace must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      },
      default: (answers: any) => answers.name,
    }, {
      type: 'input',
      name: 'host',
      when: !flags.host,
    }, {
      type: 'input',
      name: 'service_token',
      message: 'service token:',
      when: !flags.service_token,
    }, {
      type: 'input',
      name: 'cluster_ca_certificate',
      message: 'cluster certificate:',
      when: !flags.cluster_ca_certificate,
    }]);

    answers = { ...args, ...flags, ...answers };

    return this.createArchitectEnvironment({
      name: answers.name,
      namespace: answers.namespace,
      host: answers.host,
      type: answers.type,
      service_token: await readIfFile(answers.service_token),
      cluster_ca_certificate: await readIfFile(answers.cluster_ca_certificate),
      config: answers.config_file ? await fs.readJSON(untildify((answers.config_file))) : undefined,
    });
  }

  async run() {
    const {args, flags} = this.parse(EnvironmentCreate);

    let environment;
    if (flags.type === 'kubernetes' && flags.kubeconfig && !flags.host) {
      environment = await this.runKubernetes();
    } else {
      environment = await this.runGeneric();
    }

    this.log(environment);
  }
}
