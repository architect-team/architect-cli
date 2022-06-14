import { Flags } from '@oclif/core';
import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Dictionary, ResourceSlugUtils, sortOnKeys } from '../../';
import Account from '../account/account.entity';
import Environment from './environment.entity';

export interface Replica {
  ext_ref: string;
  node_ref: string;
  resource_ref: string;
  created_at: string;
  display_name?: string;
}

export class EnvironmentUtils {
  static flags = {
    environment: {
      non_sensitive: true,
      ...Flags.string({
        description: 'Architect environment',
        char: 'e',
        env: 'ARCHITECT_ENVIRONMENT',
        parse: async (value) => value.toLowerCase(),
      }),
    },
  };

  static async getEnvironment(api: AxiosInstance, account: Account, environment_name?: string): Promise<Environment> {
    if (process.env.ARCHITECT_ENVIRONMENT === environment_name && process.env.ARCHITECT_ENVIRONMENT) {
      console.log(chalk.blue(`Using environment from environment variables: `) + environment_name);
    }

    let environment: Environment;
    if (environment_name) {
      environment = (await api.get(`/accounts/${account.id}/environments/${environment_name}`)).data;
    } else {
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

      // inquirer-autocomplete-prompt doesn't catch exceptions in source...
      const { data } = await api.get(`/accounts/${account.id}/environments`, { params: { limit: 1 } });
      if (!data.total) {
        throw new Error(`No configured environments. Run 'architect environment:create -a ${account.name}'.`);
      }

      const answers: { environment: Environment } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'environment',
          message: 'Select a environment',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await api.get(`/accounts/${account.id}/environments`, { params: { q: input, limit: 10 } });
            const environments = data.rows as Environment[];
            return environments.map((e) => ({ name: e.name, value: e }));
          },
        },
      ]);
      environment = answers.environment;
    }
    return environment;
  }

  static async getReplica(replicas: Replica[]): Promise<Replica> {
    if (replicas.length === 1) {
      return replicas[0];
    } else {
      let service_refs: Dictionary<Replica[]> = {};
      for (const replica of replicas) {
        if (!service_refs[replica.resource_ref]) {
          service_refs[replica.resource_ref] = [];
        }
        service_refs[replica.resource_ref].push(replica);
      }
      service_refs = sortOnKeys(service_refs);

      let filtered_replicas: Replica[];
      if (Object.keys(service_refs).length === 1) {
        filtered_replicas = replicas;
      } else {
        const answers: any = await inquirer.prompt([
          {
            type: 'autocomplete',
            name: 'service',
            message: 'Select a service',
            source: (answers_so_far: any, input: string) => {
              return Object.entries(service_refs).map(([service_ref, sub_replicas]) => ({
                name: service_ref,
                value: sub_replicas,
              }));
            },
          },
        ]);
        filtered_replicas = answers.service;
      }

      if (filtered_replicas.length === 1) {
        return filtered_replicas[0];
      }

      filtered_replicas = filtered_replicas.sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      console.log(`Found ${filtered_replicas.length} replicas of service:`);
      const answers: any = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'replica',
          message: 'Select a replica',
          source: (answers_so_far: any, input: string) => {
            return filtered_replicas.map((r, index) => {
              const { resource_name } = ResourceSlugUtils.parse(r.resource_ref);
              r.display_name = `${resource_name}:${index}`;
              return {
                name: `${r.display_name} (${r.ext_ref})`,
                value: r,
              };
            });
          },
        },
      ]);
      return answers.replica;
    }
  }
}
