import fs from 'fs-extra';
import * as http from 'http';
import opener from 'opener';
import path from 'path';
import BaseCommand from '../base-command';
import PortUtil from '../common/utils/port';

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

export default class Doctor extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  history: any[] = [];

  static description = 'Get debugging information for troubleshooting';
  static usage = 'doctor';
  static history_length_hint = `${DOCTOR_PROPERTIES.HISTORY_LENGTH.LOWER_BOUND_INCLUSIVE} to ${DOCTOR_PROPERTIES.HISTORY_LENGTH.UPPER_BOUND_INCLUSIVE} inclusive`;
  static flags: any = {
    ...BaseCommand.flags,
  };

  async numRecordsInputIsValid(num?: any): Promise<boolean> {
    if (!num || isNaN(num)) {
      return false;
    }
    return (num >= DOCTOR_PROPERTIES.HISTORY_LENGTH.LOWER_BOUND_INCLUSIVE &&
      num <= DOCTOR_PROPERTIES.HISTORY_LENGTH.UPPER_BOUND_INCLUSIVE);
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
    const answers: any = await inquirer.prompt([
      {
        type: 'number',
        name: 'history',
        default: DOCTOR_PROPERTIES.HISTORY_LENGTH.DEFAULT_VALUE,
        message: `How many historical commands should we include in the report? (${Doctor.history_length_hint})`,
        filter: async (input: any) => await this.numRecordsInputIsValid(input as number) ? input : DOCTOR_PROPERTIES.HISTORY_LENGTH.DEFAULT_VALUE,
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

    // .yaml && .yml files removed from report's config_dir_files
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
            ...record._extra.docker_info,
            Containers: undefined,
          },
        },
      }));
    }

    const port = await PortUtil.getAvailablePort(60000);
    await this.listenForDoctorReportRequest(port);
  }
}
