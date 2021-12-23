import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../architect/account/account.utils';
import Deployment from '../architect/deployment/deployment.entity';
import Environment from '../architect/environment/environment.entity';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import Command from '../base-command';
import { ArchitectError, ComponentSlugUtils, ServiceSlugUtils, ServiceVersionSlugUtils } from '../dependency-manager/src';
import { resourceRefToNodeRef } from '../dependency-manager/src/config/component-config';

export default class Logs extends Command {
  static description = 'Get logs from services';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    follow: flags.boolean({
      description: 'Specify if the logs should be streamed.',
      char: 'f',
      default: false,
    }),
    since: flags.string({
      description: 'Only return logs newer than a relative duration like 5s, 2m, or 3h. Defaults to all logs. Only one of since-time / since may be used.',
      default: '',
    }),
    raw: flags.boolean({
      description: 'Show the raw output of the logs.',
      default: false,
    }),
    tail: flags.integer({
      description: 'Lines of recent log file to display. Defaults to -1 with no selector, showing all log lines otherwise 10, if a selector is provided.',
      default: -1,
    }),
    timestamps: flags.boolean({
      description: 'Include timestamps on each line in the log output.',
      default: false,
    }),
  };

  static args = [{
    name: 'resource',
    description: 'Name of resource',
    required: false,
    parse: (value: string): string => value.toLowerCase(),
  }];

  async run(): Promise<void> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { args, flags } = this.parse(Logs);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const namespace = environment.namespace;

    interface Replicas {
      ext_ref: string;
      node_ref: string;
      resource_ref: string;
    }

    const { data: replicas }: { data: Replicas[] } = await this.app.api.get(`/environments/${environment.id}/replicas`);

    if (!replicas.length)
      throw new ArchitectError(`No replicas found for ${'TODO:534'}`);

    const replica = replicas[0];

    const { service_name } = ServiceVersionSlugUtils.parse(replica.resource_ref);
    const display_name = service_name;
    /*
    const pod_names = pods.map((pod: any) => pod.metadata.name) as string[];
    const pod_name = await this.getPodName(service_name, pod_names);
    let display_name;
    if (pods.length === 1) {
      display_name = service_name;
    } else {
      display_name = `${service_name}:${pod_names.indexOf(pod_name)}`;
    }
    */

    const log_params: any = {};
    log_params.ext_ref = replica.ext_ref;
    log_params.container = replica.node_ref;
    if (flags.follow)
      log_params.follow = flags.follow;
    if (flags.since)
      log_params.since = flags.since;
    if (flags.tail >= 0)
      log_params.tail = flags.tail;
    if (flags.timestamps)
      log_params.timestamps = flags.timestamps;

    const { data: log_stream } = await this.app.api.get(`/environments/${environment.id}/logs`, {
      params: log_params,
      responseType: 'stream',
    });

    // Stream logs
    const prefix = flags.raw ? '' : `${chalk.cyan(chalk.bold(display_name))} ${chalk.hex('#D3D3D3')('⏐')}`;
    const columns = process.stdout.columns - (display_name.length + 3);

    let show_header = true;
    const log = (txt: string) => {
      if (flags.raw) {
        this.log(txt);
      } else {
        if (show_header) {
          this.log(chalk.bold(chalk.white('Logs:')));
          this.log(chalk.bold(chalk.white('―'.repeat(process.stdout.columns))));
          show_header = false;
        }
        // Truncate
        if (txt.length > columns) {
          txt = txt.substr(0, columns - 3) + '...';
        }
        this.log(prefix, chalk.cyan(txt));
      }
    };

    let stdout = '';
    log_stream.on('data', (chunk: string) => {
      stdout += chunk;
      const lines = stdout.split('\n');
      while (lines.length > 1) {
        const line = lines.shift() || '';
        log(line);
      }
      stdout = lines.shift() || '';
    });
    log_stream.on('end', () => {
      if (stdout) {
        log(stdout);
      }
    });
  }

  async getNodeRef(environment: Environment, resource: string): Promise<{ node_ref: string, service_name: string }> {
    let account_name = '';
    let component_name = '';
    let service_name = '';
    if (resource) {
      try {
        const parsed = ComponentSlugUtils.parse(resource);
        account_name = parsed.component_account_name;
        component_name = parsed.component_name;
      } catch {
        const parsed = ServiceSlugUtils.parse(resource);
        account_name = parsed.component_account_name;
        component_name = parsed.component_name;
        service_name = parsed.service_name;
      }
    }

    const { data: deployments }: { data: Deployment[] } = await this.app.api.get(`/environments/${environment.id}/instances`);

    if (!deployments)
      throw new ArchitectError('This environment has no deployed components.');

    const matching_deployments = deployments.filter((deployment) => {
      if (!deployment.component_version) {
        return false;
      }
      if (account_name && component_name) {
        return `${account_name}/${component_name}` === deployment.component_version.config.name;
      } else if (account_name) {
        return deployment.component_version.config.name.startsWith(`${account_name}/`);
      }
      return true;
    });

    if (!matching_deployments.length)
      throw new ArchitectError('No components found matching search criteria');

    let deployment: Deployment;
    if (matching_deployments.length === 1) {
      deployment = matching_deployments[0];
    } else {
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'component',
          message: 'Select a component',
          source: (answers_so_far: any, input: string) => {
            return matching_deployments.map((d) => ({
              name: d.component_version.config.name,
              value: d,
            }));
          },
        },
      ]);
      deployment = answers.component;
    }
    account_name = deployment.component_version.component.account.name;
    component_name = deployment.component_version.component.name;

    if (!service_name) {
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'service',
          message: `Select a service from ${deployment.component_version.config.name}`,
          source: (answers_so_far: any, input: string) => {
            return Object.keys(deployment.component_version.config.services || {}).map((service_name) => ({
              name: service_name,
              value: service_name,
            }));
          },
        },
      ]);
      service_name = answers.service;
    }

    const service_ref = ServiceVersionSlugUtils.build(account_name, component_name, service_name, deployment?.component_version.tag, deployment.metadata.instance_name);
    const node_ref = resourceRefToNodeRef(service_ref, deployment.instance_id);

    return {
      node_ref,
      service_name,
    };
  }

  async getPodName(service_name: string, pod_names: string[]): Promise<string> {
    let pod_name;
    if (pod_names.length === 1) {
      pod_name = pod_names[0];
    } else {
      this.log(`Found ${pod_names.length} replicas of service:`);
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'replica',
          message: 'Select a replica',
          source: (answers_so_far: any, input: string) => {
            return pod_names.map((pn: any) => ({
              name: `${service_name}:${pod_names.indexOf(pn)} (pod:${pn})`,
              value: pn,
            }));
          },
        },
      ]);
      pod_name = answers.replica;
    }
    return pod_name;
  }
}
