import axios from 'axios';
import chalk from 'chalk';
import execa from 'execa';
import inquirer from 'inquirer';
import PromptUtils from '../../common/utils/prompt-utils';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import inquirerPrompt from 'inquirer-autocomplete-prompt';
import LocalPaths from '../../paths';

interface Selection {
  name: string,
  type: string,
  repository?: string,
  'architect-file'?: string,
}

export default class ProjectUtils {
  static async prompt(choices: Selection[], message: string): Promise<Selection> {
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
    return answers.selected as Selection;
  }

  static async conversionPrompt(message: string): Promise<boolean> {
    const answers: { selected: boolean } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'selected',
        message: message,
      },
    ]);
    return answers.selected;
  }

  static async fetchJsonFromGitHub(url: string): Promise<Selection[]> {
    const response = await axios.get(url)
    .then((res: any) => res.data)
    .catch((err: any) => {
      throw new Error(`Failed to fetch ${url}`);
    });
    return response.choices as Selection[];
  }

  static async downloadGitHubRepos(selection: Selection, project_dir: string): Promise<void> {
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

  static async getSelections(): Promise<Selection> {
    // get choices from template-configs repository
    const config_file = LocalPaths.GITHUB_TEMPLATE_CONFIG_URL;
    const config_json = await this.fetchJsonFromGitHub(config_file);

    const project = await this.prompt(config_json, 'Please select a framework/language for your project');

    return project;
  }
}
