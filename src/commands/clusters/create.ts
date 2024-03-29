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
import ClusterUtils, { CreateClusterInput } from '../../architect/cluster/cluster.utils';
import PipelineUtils from '../../architect/pipeline/pipeline.utils';
import BaseCommand from '../../base-command';
import { RequiresKubectl } from '../../common/kubectl/helper';
import { AgentClusterUtils } from '../../common/utils/agent-cluster.utils';
import { booleanString } from '../../common/utils/oclif';

export default class ClusterCreate extends BaseCommand {
  static aliases = ['clusters:register', 'cluster:create'];
  static description = 'Register a new cluster with Architect Cloud';
  static examples = [
    'architect clusters:create --account=myaccount',
    'architect clusters:register --account=myaccount --kubeconfig=~/.kube/config --auto-approve',
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
      description: `Please use --auto-approve.`,
      hidden: true,
      sensitive: false,
      default: false,
    }),
    'auto-approve': booleanString({
      sensitive: false,
      default: false,
    }),
    // TODO https://gitlab.com/architect-io/architect-cli/-/issues/514
    type: Flags.string({
      char: 't',
      deprecated: true,
      options: ['AGENT', 'agent'],
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
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  @RequiresKubectl()
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

    const flags_map: Dictionary<boolean> = {};
    for (const flag of flags.flag) {
      flags_map[flag] = true;
    }

    const account = await AccountUtils.getAccount(this.app, flags.account, { account_message: 'Select an account to register the cluster with' });

    const { data } = await this.app.api.get(`/accounts/${account.id}/clusters`);
    const clusters = data.rows as Cluster[];
    const cluster_names = new Set(clusters.map(cluster => cluster.name.toLowerCase()));

    if (args.cluster && cluster_names.has(args.cluster)) {
      console.log(chalk.red('A cluster already exists with the desired name. Please enter a new one.'));
      args.cluster = '';
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'cluster',
        message: 'What would you like to name your new cluster?',
        when: !args.cluster,
        filter: value => value.toLowerCase(),
        validate: value => {
          if (cluster_names.has(value.toLowerCase())) {
            return `a cluster with the name ${value} already exists for this account`;
          }
          if (Slugs.ArchitectSlugValidator.test(value)) return true;
          return `cluster ${Slugs.ArchitectSlugDescription}`;
        },
        ciMessage: 'Cluster name is required in CI pipelines ex. architect cluster:create <name> --auto-approve',
      },
    ]);

    const cluster_name = args.cluster || answers.cluster;
    if (!Slugs.ArchitectSlugValidator.test(cluster_name)) {
      throw new Error(`cluster ${Slugs.ArchitectSlugDescription}`);
    }

    const kube_contexts = await this.setupKubeContext(flags);
    await ClusterUtils.checkServerVersion(flags.kubeconfig);
    await ClusterUtils.checkClusterNodes(flags.kubeconfig);

    try {
      const cluster_dto = {
        name: cluster_name,
        ...await AgentClusterUtils.configureAgentCluster(flags, kube_contexts.current_context.name),
        flags: flags_map,
      };

      CliUx.ux.action.start('Registering cluster with Architect');
      const created_cluster = await this.postClusterToApi(cluster_dto, account.id);
      CliUx.ux.action.stop();
      this.log(`Cluster registered: ${this.app.config.app_host}/${account.name}/clusters/new?cluster_id=${created_cluster.id}`);

      CliUx.ux.action.start(chalk.blue('Installing the agent'));
      await AgentClusterUtils.installAgent(flags, created_cluster.token.access_token, AgentClusterUtils.getServerAgentHost(this.app.config.agent_server_host), this.app.config);
      await AgentClusterUtils.waitForAgent(flags);
      CliUx.ux.action.stop();
      await this.installAppliations(flags, created_cluster, cluster_name, account.name);
      return created_cluster;
    } finally {
      await this.setContext(flags, kube_contexts.original_context);
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
          ciMessage: '--kubeconfig or --auto-approve flag is required in CI pipelines',
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
