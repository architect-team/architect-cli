import axios from 'axios';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { buildSpecFromPath, ComponentSpec } from '../../';
import AppService from '../../app-config/service';
import PromptUtils from '../../common/utils/prompt-utils';
import { EnvironmentSpecValue } from '../../dependency-manager/spec/resource-spec';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import inquirerPrompt from 'inquirer-autocomplete-prompt';

interface Selection {
  name: string,
  type: string,
  repository?: string,
  'architect-file'?: string,
}

export default class ProjectUtils {
  static getRootComponent(selections: Dictionary<Selection>): string {
    if (selections.frontend) {
      return selections.frontend.name.toLowerCase();
    } else if (selections.backend) {
      return selections.backend.name.toLowerCase();
    }
    return '';
  }

  static async prompt(choices: any[], message: string): Promise<any> {
    inquirer.registerPrompt('autocomplete', inquirerPrompt);
    const answers: { selected: any } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selected',
        message: message,
        source: async (answers_so_far: any, input: string) => {
          return choices.map((p) => ({ name: p.name, value: p }));
        },
      },
    ]);
    return answers.selected;
  }

  static async fetchJsonFromGitHub(url: string): Promise<any> {
    const response = await axios.get(url)
    .then((res: any) => res.data)
    .catch((err: any) => {
      throw new Error(`Failed to fetch ${url}`);
    });
    return response;
  }

  static async downloadGitHubRepos(selection: Dictionary<Dictionary<any>>, project_dir: string): Promise<void> {
    // download repositories
    if (selection.repository) {
      await execa('git', ['clone', selection.repository.toString(), project_dir + '/' + selection.name.toLowerCase()], { stdio: 'ignore' });
      await PromptUtils.oclifTimedSpinner(
        `Pulling down GitHub Repository`,
         selection.name.toLowerCase(),
        `${chalk.green('✓')} ${selection.name.toLowerCase()}`,
      );
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  static async getSelections(): Promise<Dictionary<Selection>> {
    // get choices from template-configs repository
    const config_file = 'https://raw.githubusercontent.com/architect-team/template-configs/main/config.json';
    const config_json = await this.fetchJsonFromGitHub(config_file) as Dictionary<any>;

    console.log(config_json);
    const choices = config_json.choices;

    const project = await this.prompt(choices, 'Please select a framework/language for your project');

    return project;
  }
}
