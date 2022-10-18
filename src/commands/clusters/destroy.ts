import { CliUx, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../../architect/account/account.utils';
import ClusterUtils from '../../architect/cluster/cluster.utils';
import BaseCommand from '../../base-command';
import { booleanString } from '../../common/utils/oclif';

export default class ClusterDestroy extends BaseCommand {
  static aliases = ['clusters:deregister', 'cluster:destroy', 'clusters:destroy'];
  static description = 'Deregister a cluster from Architect';
  static examples = [
    'architect cluster:destroy --account=myaccount architect',
    'architect clusters:deregister --account=myaccount --auto-approve --force architect',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    auto_approve: booleanString({
      description: `${BaseCommand.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
      sensitive: false,
      default: false,
    }),
    'auto-approve': booleanString({
      description: 'Automatically apply the changes',
      default: false,
      sensitive: false,
    }),
    force: booleanString({
      description: 'Force the deletion even if the cluster is not empty',
      char: 'f',
      default: false,
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'cluster',
    description: 'Name of the cluster to deregister',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

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

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ClusterDestroy);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const cluster = await ClusterUtils.getCluster(this.app.api, account, args.cluster);

    let answers = await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will deregister the cluster from the Architect system.\nPlease type in the name of the cluster to confirm.\n',
      validate: (value: any, answers: any) => {
        if (value === cluster.name) {
          return true;
        }
        return `Name must match: ${chalk.blue(cluster.name)}`;
      },
      when: !flags['auto-approve'],
    }]);

    answers = { ...args, ...flags, ...answers };
    const { data: account_cluster } = await this.app.api.get(`/accounts/${account.id}/clusters/${cluster.name}`);

    CliUx.ux.action.start(chalk.blue('Deregistering cluster'));
    const params: any = {};
    if (answers.force) {
      params.force = 1;
    }
    await this.app.api.delete(`/clusters/${account_cluster.id}`, { params });
    CliUx.ux.action.stop();
    this.log(chalk.green('Cluster deregistered'));
  }
}
