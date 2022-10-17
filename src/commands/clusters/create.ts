import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { ArchitectError, Dictionary, Slugs } from '../..';
import AccountUtils from '../../architect/account/account.utils';
import Cluster from '../../architect/cluster/cluster.entity';
import { CreateClusterInput } from '../../architect/cluster/cluster.utils';
import PipelineUtils from '../../architect/pipeline/pipeline.utils';
import BaseCommand from '../../base-command';
import { AgentClusterUtils } from '../../common/utils/agent-cluster.utils';
import { KubernetesClusterUtils } from '../../common/utils/kubernetes-cluster.utils';
import { booleanString } from '../../common/utils/oclif';

export default class ClusterCreate extends BaseCommand {
  static aliases = ['clusters:register', 'cluster:create', 'clusters:create'];
  static description = 'Register a new cluster with Architect Cloud';
  static examples = [
    'architect clusters:create --account=myaccount',
    'architect clusters:register --account=myaccount --type=kubernetes --kubeconfig=~/.kube/config --auto-approve',
  ];
  static args = [{
    sensitive: false,
    name: 'cluster',
    description: 'Name to give the cluster',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    auto_approve: booleanString({
      description: `${BaseCommand.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
      sensitive: false,
      default: false,
    }),
    ['auto-approve']: booleanString({
      sensitive: false,
      default: false,
    }),
    // TODO https://gitlab.com/architect-io/architect-cli/-/issues/514
    type: Flags.string({
      char: 't',
      options: ['KUBERNETES', 'kubernetes'],
      sensitive: false,
    }),
    host: Flags.string({
      char: 'h',
      sensitive: false,
    }),
    kubeconfig: Flags.string({
      char: 'k',
      default: '~/.kube/config',
      exclusive: ['host'],
      sensitive: false,
    }),
    flag: Flags.string({
      multiple: true,
      default: [],
      sensitive: false,
    }),
  };

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    await this.createCluster();
  }

  private async installAppliations(flags: any, created_cluster: Cluster, cluster_name: string, account_name: string) {
    if (!flags['auto-approve']) {
      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'application_install',
        message: `Would you like to install the requisite networking applications? This is a required step before using Architect with this cluster. More details at the above URL.`,
      });
      if (!confirmation.application_install) {
        this.warn(`Installation cancelled. You will be unable to deploy services to this cluster.\n\nIf you decide to proceed with installation, you can do so at the above URL. Or if you would like to deregister this cluster from Architect, run: \n\narchitect cluster:destroy -a ${account_name} --auto_approve ${cluster_name}`);
        return;
      }
    }

    this.log(`Hang tight! This could take as long as 15m, so feel free to grab a cup of coffee while you wait.`);
    CliUx.ux.action.start(chalk.blue('Installing cluster applications'));
    const pipeline_id = await this.createClusterApplications(created_cluster.id);
    await PipelineUtils.pollPipeline(this.app, pipeline_id);
    CliUx.ux.action.stop();
  }

  private async createCluster() {
    const { args, flags } = await this.parse(ClusterCreate);

    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'cluster',
        message: 'What would you like to name your new cluster?',
        when: !args.cluster,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (Slugs.ArchitectSlugValidator.test(value)) return true;
          return `cluster ${Slugs.ArchitectSlugDescription}`;
        },
      },
    ]);

    const cluster_name = args.cluster || answers.cluster;
    if (!Slugs.ArchitectSlugValidator.test(cluster_name)) {
      throw new Error(`cluster ${Slugs.ArchitectSlugDescription}`);
    }

    const flags_map: Dictionary<boolean> = {};
    for (const flag of flags.flag) {
      flags_map[flag] = true;
    }

    const account = await AccountUtils.getAccount(this.app, flags.account, { account_message: 'Select an account to register the cluster with' });

    const kube_contexts = await this.setupKubeContext(flags);

    try {
      const cluster_dto = {
        name: cluster_name,
        ...await this.createArchitectCluster(flags, kube_contexts.current_context),
        flags: flags_map,
      };

      CliUx.ux.action.start('Registering cluster with Architect');
      const created_cluster = await this.postClusterToApi(cluster_dto, account.id);
      CliUx.ux.action.stop();
      this.log(`Cluster registered: ${this.app.config.app_host}/${account.name}/clusters/new?cluster_id=${created_cluster.id}`);

      if (flags.type?.toLowerCase() === 'agent') {
        CliUx.ux.action.start(chalk.blue('Installing the agent'));
        await AgentClusterUtils.installAgent(flags, created_cluster.token.access_token, AgentClusterUtils.getServerAgentHost(this.app.config.agent_server_host), this.app.config);
        await AgentClusterUtils.waitForAgent(flags);
        CliUx.ux.action.stop();
        await this.installAppliations(flags, created_cluster, cluster_name, account.name);
      } else {
        await this.installAppliations(flags, created_cluster, cluster_name, account.name);
      }
      return created_cluster;
    } finally {
      await this.setContext(flags, kube_contexts.original_context);
    }
  }

  async createArchitectCluster(flags: any, context: any): Promise<CreateClusterInput> {
    const agent_display_name = 'agent (BETA)';
    const cluster_type_answers: any = await inquirer.prompt([
      {
        when: !flags.type,
        type: 'list',
        name: 'cluster_type',
        message: 'What type of cluster would you like to register?',
        choices: [
          'kubernetes',
          agent_display_name,
          //...(this.app.config.environment !== ENVIRONMENT.PRODUCTION ? [agent_display_name] : []),
        ],
      },
    ]);
    if (!flags.type && cluster_type_answers.cluster_type === agent_display_name) {
      cluster_type_answers.cluster_type = 'agent';
    }

    const selected_type = (flags.type || cluster_type_answers.cluster_type).toLowerCase();

    flags.type = selected_type;
    switch (selected_type) {
      case 'agent':
        return await AgentClusterUtils.configureAgentCluster(flags, context.name);
      case 'kubernetes':
        return await KubernetesClusterUtils.configureKubernetesCluster(flags, this.app.config.environment, context);
      case 'architect':
        throw new Error(`You cannot create an Architect cluster from the CLI. One Architect cluster is registered by default per account.`);
      default:
        throw new Error(`ClusterType=${selected_type} is not currently supported`);
    }
  }

  async createClusterApplications(cluster_id: string): Promise<any> {
    const { data: deployment } = await this.app.api.post(`/clusters/${cluster_id}/apps`);
    return deployment.pipeline.id;
  }

  async postClusterToApi(dto: CreateClusterInput, account_id: string): Promise<Cluster> {
    const { data: cluster } = await this.app.api.post(`/accounts/${account_id}/clusters`, dto);
    return cluster;
  }

  private async setupKubeContext(flags: any): Promise<{ original_context: any, current_context: any }> {
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
      const new_cluster_answers: any = await inquirer.prompt([
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
      kube_context = new_cluster_answers.context;
    }

    return {
      original_context: original_kubecontext,
      current_context: kube_context,
    };
  }

  private async setContext(flags: any, context: any) {
    const kubeconfig_path = untildify(flags.kubeconfig);
    const set_kubeconfig = ['--kubeconfig', untildify(kubeconfig_path), '--namespace', 'default'];
    await execa('kubectl', [
      ...set_kubeconfig,
      'config', 'set',
      'current-context', context,
    ]);
  }
}
