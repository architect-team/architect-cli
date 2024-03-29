import { Flags } from '@oclif/core';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import { inspect } from 'util';
import BaseCommand from '../base-command';

interface DOCTOR_INPUT_PROPERTIES {
  HISTORY_LENGTH: {
    DEFAULT_VALUE: number;
    LOWER_BOUND_INCLUSIVE: number;
    UPPER_BOUND_INCLUSIVE: number;
  };
  COMPOSE: {
    DEFAULT_VALUE: boolean;
  };
  DOCKER: {
    DEFAULT_VALUE: boolean;
  };
}

const DOCTOR_PROPERTIES: DOCTOR_INPUT_PROPERTIES = {
  HISTORY_LENGTH: {
    DEFAULT_VALUE: 5,
    LOWER_BOUND_INCLUSIVE: 1,
    UPPER_BOUND_INCLUSIVE: 5,
  },
  COMPOSE: {
    DEFAULT_VALUE: true,
  },
  DOCKER: {
    DEFAULT_VALUE: true,
  },
};

interface SentryHistory {
  _extra?: {
    docker_info?: {
      Client?: {
        Platform?: Record<string, unknown>;
        CloudIntegration?: string;
        Version?: string;
        ApiVersion?: string;
        DefaultAPIVersion?: string;
        GitCommit?: string;
        GoVersion?: string;
        Os?: string;
        Arch?: string;
        BuildTime?: string;
        Context?: string;
      };
      Server?: {
        Platform?: {
          Name?: string;
        };
        Components?: Record<string, unknown>[];
        Version?: string;
        ApiVersion?: string;
        MinAPIVersion?: string;
        GitCommit?: string;
        GoVersion?: string;
        Os?: string;
        Arch?: string;
        KernelVersion?: string;
        BuildTime?: string;
      };
      Containers?: Record<string, unknown>[];
    }
    command?: string;
    environment?: string;
    config_dir_files?: Record<string, unknown>[];
    config_file?: string;
    cwd?: string;
    log_level?: string;
    node_versions?: Record<string, unknown>[];
  };
  node_version?: string;
  os_info?: {
    username?: string;
    homedir?: string;
    shell?: string;
  };
  os_release?: string;
  os_type?: string;
  os_platform?: string;
  os_arch?: string;
  os_hostname?: string;
  _span?: {
    description?: string;
    op?: string;
    span_id?: string;
    status?: string;
    tags?: {
      environment?: string;
      cli?: string;
      node_runtime?: string;
      os?: string;
      user?: string;
      'user-email'?: string;
    },
    trace_id?: string;
  };
}

export default class Doctor extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  history: SentryHistory[] = [];

  static description = 'Get debugging information for troubleshooting';
  static usage = 'doctor';

  static examples = [
    'architect doctor',
    'architect doctor -o ./myoutput.yml',
  ];
  static history_length_hint = `${DOCTOR_PROPERTIES.HISTORY_LENGTH.LOWER_BOUND_INCLUSIVE} to ${DOCTOR_PROPERTIES.HISTORY_LENGTH.UPPER_BOUND_INCLUSIVE} inclusive`;
  static flags: any = {
    ...BaseCommand.flags,
    output: Flags.string({
      description: 'Choose a file to output the debug information to',
      char: 'o',
      sensitive: false,
    }),
  };

  async numRecordsInputIsValid(num?: any): Promise<boolean> {
    if (!num || Number.isNaN(num)) {
      return false;
    }
    return (num >= DOCTOR_PROPERTIES.HISTORY_LENGTH.LOWER_BOUND_INCLUSIVE &&
      num <= DOCTOR_PROPERTIES.HISTORY_LENGTH.UPPER_BOUND_INCLUSIVE);
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Doctor);
    // eslint-disable-next-line unicorn/prefer-module
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
    const answers = await inquirer.prompt([
      {
        type: 'number',
        name: 'history',
        default: DOCTOR_PROPERTIES.HISTORY_LENGTH.DEFAULT_VALUE,
        message: `How many historical commands should we include in the report? (${Doctor.history_length_hint})`,
        filter: async (input) => await this.numRecordsInputIsValid(input as number) ? input : DOCTOR_PROPERTIES.HISTORY_LENGTH.DEFAULT_VALUE,
      },
      {
        type: 'confirm',
        name: 'compose',
        message: 'Include .yml filenames to the report\'s config directory listing?',
        default: DOCTOR_PROPERTIES.COMPOSE.DEFAULT_VALUE,
      },
      {
        type: 'confirm',
        name: 'docker',
        message: `Include currently running docker container information to the report?`,
        default: DOCTOR_PROPERTIES.DOCKER.DEFAULT_VALUE,
      },
    ]);

    const command_metadata = await this.sentry.readCommandHistoryFromFileSystem();
    this.history = (command_metadata || []).slice(~Math.min(answers.history, command_metadata.length) + 1);

    // .yml files removed from report's config_dir_files
    if (!answers.compose) {
      this.history = this.history.map((record) => ({
        ...record,
        _extra: {
          ...record._extra,
          config_dir_files: (record._extra?.config_dir_files || []).filter((f: any) => !f.name.includes('.yml')),
        },
      }));
    }

    // docker containers removed from doctor report
    if (!answers.docker) {
      this.history = this.history.map((record) => ({
        ...record,
        _extra: {
          ...record._extra,
          docker_info: {
            ...record._extra?.docker_info,
            Containers: undefined,
          },
        },
      }));
    }

    let seen = false;
    if (!flags.output) {
      console.log(inspect(this.history, false, 100, true));
      seen = true;
      const answers = await inquirer.prompt([
        {
          type: 'string',
          name: 'output',
          default: '',
          message: `Enter a file path to save the above information. Leave blank to ignore.`,
        },
      ]);
      flags.output = answers.output;
    }

    if (flags.output) {
      try {
        fs.writeJson(flags.output, this.history, { spaces: 2 });
        return console.log(chalk.green('Please submit the generated information file with your support ticket at https://support.architect.io/'));
      } catch (e: any) {
        if (!seen) {
          console.log(inspect(this.history, false, 100, true));
        }
        console.log(chalk.yellow('Unable to save information file to the specified file path'));
      }
    }

    console.log(chalk.green('Please submit the generated information above with your support ticket at https://support.architect.io/'));
  }
}
