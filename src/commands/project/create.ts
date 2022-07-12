import inquirer from 'inquirer';
import { Flags } from '@oclif/core';
import ProjectUtils from '../../architect/project/project.utils';
import BaseCommand from '../../base-command';

export default class ProjectCreate extends BaseCommand {
  static description = 'Create project from existing Architect templates';
  static aliases = ['project:create'];

  static flags = {
    ...BaseCommand.flags,
    project: Flags.string({
      char: 'p',
      description: 'Architect project you would like to create',
      required: false,
    }),
  };

  static args = [{
    name: 'project_name',
    description: 'Name of your project',
    required: true,
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(ProjectCreate);

    let chosen_project;
    if (!flags.project) {
      const answer: { chosen: any } = await inquirer.prompt([
        {
          name: 'chosen',
          message: 'Provide a project name:',
          type: 'input',
        }]);
      chosen_project = answer.chosen;
    } else {
      chosen_project = flags.project;
    }
    
    const selections = await ProjectUtils.getSelections(chosen_project);
    await ProjectUtils.downloadGitHubRepos(selections, args.project_name);
    await ProjectUtils.createArchitectYaml(selections, args.project_name);
    this.log(`Successfully created project ${args.project_name}. Please run the architect.yml file located in the directory of ${args.project_name}.`);
  }
}
