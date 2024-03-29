import { Flags } from '@oclif/core';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { ArchitectError, Dictionary, ResourceSlugUtils, sortOnKeys } from '../../';
import Account from '../account/account.entity';
import { Paginate } from '../types';
import Environment from './environment.entity';

export interface Replica {
  ext_ref: string;
  node_ref: string;
  resource_ref: string;
  created_at: string;
  display_name?: string;
  ports: number[];
}

export class GetEnvironmentOptions {
  environment_name?: string;
  strict? = true;
}

export interface ScaleServiceDto {
  resource_slug?: string;
  replicas?: number;
}

export interface UpdateEnvironmentDto extends ScaleServiceDto {
  clear_scaling?: boolean;
}

export interface ParsedCertificate {
  dns_names: string[];
  service_dns_names: string[];
  expiration_date: string; // of the format 2023-04-19T00:46:08.000Z
  renewal_time: string; // of the format 2023-04-19T00:46:08.000Z
  status: 'Ready' | 'Issuing' | 'Failed';
  metadata: {
    labels: Dictionary<string>;
  };
}

export class EnvironmentUtils {
  static flags = {
    environment: Flags.string({
      description: 'Architect environment',
      char: 'e',
      env: 'ARCHITECT_ENVIRONMENT',
      parse: async (value) => value.toLowerCase(),
      sensitive: false,
    }),
  };

  static async getEnvironment(api: AxiosInstance, account: Account, get_environment_options?: GetEnvironmentOptions): Promise<Environment> {
    const environment_name = get_environment_options?.environment_name;
    if (process.env.ARCHITECT_ENVIRONMENT === environment_name && process.env.ARCHITECT_ENVIRONMENT) {
      console.log(chalk.blue(`Using environment from environment variables: `) + environment_name);
    }

    let environment: Environment;
    if (environment_name) {
      try {
        const response = await api.get(`/accounts/${account.id}/environments/${environment_name}`, {
          validateStatus: function (status): boolean {
            const _environment_not_found = status === 404;
            return status === 200 || (_environment_not_found && get_environment_options?.strict === false);
          },
        });
        environment = await response?.data;
      } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            throw new ArchitectError(`Environment '${environment_name}' not found`);
          }
        throw err;
      }
    } else {
      // eslint-disable-next-line unicorn/prefer-module
      inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

      // inquirer-autocomplete-prompt doesn't catch exceptions in source...
      const { data } = await api.get<Paginate<Environment>>(`/accounts/${account.id}/environments`, { params: { limit: 1 } });

      if (!data.total) {
        throw new Error(`No configured environments. Run 'architect environment:create -a ${account.name}'.`);
      }

      if (data.total === 1) {
        return data.rows[0];
      }

      const answers: { environment: Environment } = await inquirer.prompt([
        {
          type: 'autocomplete',
          name: 'environment',
          message: 'Select an environment',
          filter: (x) => x, // api filters
          source: async (answers_so_far: any, input: string) => {
            const { data } = await api.get<Paginate<Environment>>(`/accounts/${account.id}/environments`, { params: { q: input, limit: 10 } });
            const environments = data.rows;
            return environments.map((e) => ({ name: e.name, value: e }));
          },
          ciMessage: '--environment flag is required in CI pipelines or by setting ARCHITECT_ENVIRONMENT env',
        },
      ]);
      environment = answers.environment;
    }
    return environment;
  }

  static async getReplica(replicas: Replica[], replica_index?: number): Promise<Replica> {
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
        const answers = await inquirer.prompt([
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
            ciMessage: 'The resource arg is required in CI pipelines. Ex. my-component.services.my-api',
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

      if (replica_index !== undefined) {
        if (!filtered_replicas[replica_index]) {
          throw new ArchitectError(`Replica not found at index ${replica_index}`);
        }

        return filtered_replicas[replica_index];
      }

      console.log(`Found ${filtered_replicas.length} replicas of service:`);
      const answers = await inquirer.prompt([
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
