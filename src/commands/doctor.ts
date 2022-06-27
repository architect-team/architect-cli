import { Flags } from '@oclif/core';
import fs from 'fs-extra';
import * as http from 'http';
import opener from 'opener';
import path from 'path';
import BaseCommand from '../base-command';
import PortUtil from '../common/utils/port';

interface DOCTOR_INPUT_PROPERTIES {
  NUM_RECORDS: {
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

export default class Doctor extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }
  protected static readonly properties: DOCTOR_INPUT_PROPERTIES = {
    NUM_RECORDS: {
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

  history: any[] = [];

  static description = 'Get debugging information for troubleshooting';
  static usage = 'doctor [FLAGS]';
  static num_records_hint = `${this.properties.NUM_RECORDS.LOWER_BOUND_INCLUSIVE} to ${this.properties.NUM_RECORDS.UPPER_BOUND_INCLUSIVE} inclusive.`;
  static flags: any = {
    ...BaseCommand.flags,
    records: {
      non_sensitive: true,
      ...Flags.integer({
        required: false,
        char: 'n',
        description: `Number of command history records for architect to retrieve; ${this.num_records_hint}`,
        default: this.properties.NUM_RECORDS.DEFAULT_VALUE,
      }),
    },
    compose: {
      non_sensitive: true,
      ...Flags.boolean({
        required: false,
        char: 'c',
        description: `Allows architect to include docker compose files in the list of file names residing in the configuration directory`,
        default: this.properties.COMPOSE.DEFAULT_VALUE,
      }),
    },
    docker: {
      non_sensitive: true,
      ...Flags.boolean({
        required: false,
        char: 'd',
        description: `Allows architect to include a list of currently running docker containers`,
        default: this.properties.DOCKER.DEFAULT_VALUE,
      }),
    },
  };

  protected static async numRecordsInputIsValid(num?: any): Promise<boolean> {
    if (!num || isNaN(num)) {
      return false;
    }
    return (num >= Doctor.properties.NUM_RECORDS.LOWER_BOUND_INCLUSIVE &&
      num <= Doctor.properties.NUM_RECORDS.UPPER_BOUND_INCLUSIVE);
  }

  protected async listenForDoctorReportRequest(port: number): Promise<string> {
    const doctor_html_template_path = path.join(path.dirname(fs.realpathSync(__filename)), '../static/doctor.html');
    const doctor_file = fs.readFileSync(doctor_html_template_path).toString();

    return new Promise((_, reject) => {
      const server = http.createServer();
      server.on('connection', (socket) => socket.unref());
      server.on('error', async (err) => reject(err));
      server.on('listening', async () => opener(`http://localhost:${port}`));
      server.on('request', async (req, res) => {
        try {
          req.connection.ref();
          res.writeHead(200, { 'Content-Type': 'text/html' });
          const doctor_html = doctor_file.replace('%% COMMAND_HISTORY %%', JSON.stringify(this.history));
          res.end(doctor_html, () => req.connection.unref());
        } finally {
          try {
            server.close();
          } catch {
            // already closed
          }
        }
      });
      server.listen(port);
    });
  }

  async run(): Promise<void> {
    const inquirer = require('inquirer');
    const inquirerPrompt = require('inquirer-autocomplete-prompt');
    inquirer.registerPrompt('autocomplete', inquirerPrompt);
    const { flags } = await this.parse(Doctor);
    const answers: any = await inquirer.prompt([
      {
        type: 'number',
        name: 'num_records',
        searchText: '...',
        default: await Doctor.numRecordsInputIsValid(flags.records) ? flags.records : Doctor.properties.NUM_RECORDS.DEFAULT_VALUE,
        emptyText: `Default value: ${Doctor.properties.NUM_RECORDS.DEFAULT_VALUE}`,
        message: `How many historical commands should we retrieve? (${Doctor.num_records_hint})`,
        filter: async (input: any) => await Doctor.numRecordsInputIsValid(Number(input)) ? input : Doctor.properties.NUM_RECORDS.DEFAULT_VALUE,
      },
      {
        type: 'confirm',
        name: 'compose',
        message: 'Grant architect access to add docker compose filenames?',
        default: flags.compose ? flags.compose : Doctor.properties.COMPOSE.DEFAULT_VALUE,
      },
      {
        type: 'confirm',
        name: 'docker',
        message: `Grant architect access to include running docker container's ID, Image and Name information?`,
        default: flags.docker ? flags.docker : Doctor.properties.DOCKER.DEFAULT_VALUE,
      },
    ]
    );

    const command_metadata = await this.readCommandHistoryFromFileSystem();
    this.history = (command_metadata || []).slice(~Math.min(answers.num_records, command_metadata.length) + 1);

    // .yaml && .yml files removed from report's config_dir_files
    if (!answers.compose) {
      this.history = this.history.map((record) => ({
        ...record,
        _extra: {
          ...record._extra,
          config_dir_files: (record._extra.config_dir_files || []).filter((f: any) => !f.name.includes('.yml')),
        },
      }));
    }

    // docker containers removed from doctor report
    if (!answers.docker) {
      this.history = this.history.map((record) => ({
        ...record,
        _extra: {
          ...record._extra,
          docker_containers: undefined,
        },
      }));
    }

    const port = await PortUtil.getAvailablePort(60000);
    await this.listenForDoctorReportRequest(port);
  }
}
