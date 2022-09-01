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

  static async linkSelections(app: AppService, selections: Dictionary<Selection>, project_name: string): Promise<void> {
    for (const selection of Object.values(selections)) {
      if (selection.type.toLowerCase() === 'database') {
        continue;
      }
      const key = selection.name.toLowerCase();
      const component_path = path.join(project_name, key, 'architect.yml');
      const component_config = buildSpecFromPath(component_path);
      app.linkComponentPath(component_config.name, component_path);
      await PromptUtils.oclif_timed_spinner(
        `$ architect link ${component_path}`,
        selection.name.toLowerCase(),
        `${chalk.green('✓')} ${selection.name.toLowerCase()}`
      );
    }
  }

  static async prompt(choices: any[], message: string): Promise<any> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
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

  static async fetchYamlFromGitHub(url: string): Promise<ComponentSpec> {
    const component_spec = await axios.get(url)
      .then((res: any) => yaml.load(res.data))
      .catch((err: any) => {
        throw new Error(`Failed to fetch ${url}`);
      });
    return component_spec as ComponentSpec;
  }

  static async downloadGitHubRepos(selections: Dictionary<Dictionary<any>>, project_dir: string): Promise<void> {
    const total_repositories_to_clone = Object.values(selections).filter(selection => selection.repository);
    let i = 1;
    // download any selection that has a repository
    for (const selection of Object.values(selections)) {
      if (selection.repository) {
        await execa('git', ['clone', selection.repository, project_dir + '/' + selection.name.toLowerCase()], { stdio: 'ignore' });
        await PromptUtils.oclif_timed_spinner(
          `Pulling down GitHub Repositories (${i}/${Math.max(i, total_repositories_to_clone.length)})`,
          `${selection.name || 'repository'}...`,
          `${chalk.green('✓')} ${selection.name || 'repository'}`
        );
        i++;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  static async updateServiceEnvironmentDependencies(service_environment: Dictionary<EnvironmentSpecValue>, dep_key: string): Promise<Dictionary<EnvironmentSpecValue>> {
    const dependencies_regex = new RegExp("'(.*?)'", 'g');
    for (const [env_key, env_val] of Object.entries(service_environment)) {
      if (typeof env_val === 'string' && env_val.includes('dependencies')) {
        const matches = dependencies_regex.exec(env_val);
        if (matches) {
          service_environment[env_key] = env_val.replace(matches[0], `'${dep_key.toLowerCase()}'`);
        }
      }
    }
    return service_environment;
  }

  static async switchDatabase(database_yml: ComponentSpec, backend_yml: ComponentSpec, backend_yml_path: string): Promise<void> {
    if (!backend_yml.services || !database_yml.services) {
      return;
    }

    for (const [service_key, service] of Object.entries(backend_yml.services)) {
      if (service.image) {
        backend_yml.secrets = { ...backend_yml.secrets, ...database_yml.secrets };
        backend_yml.services[service_key] = Object.values(database_yml.services)[0];
        fs.writeFileSync(path.resolve(untildify(backend_yml_path)), yaml.dump(backend_yml));
        await PromptUtils.oclif_timed_spinner(
          `Adding ${service_key} database service to ${backend_yml.name}`,
          `${service_key}...`,
          `${chalk.green('✓')} ${service_key}`
        );
      }
    }
  }

  static async updateDependencies(frontend_yml: ComponentSpec, frontend_yml_path: string, backend_component_name?: string): Promise<void> {
    if (!frontend_yml.dependencies) {
      return;
    }

    if (frontend_yml.dependencies && frontend_yml.services && backend_component_name) {
      const new_dependencies: Dictionary<string> = {};
      for (const dep_val of Object.values(frontend_yml.dependencies)) {
        new_dependencies[backend_component_name] = dep_val;
      }
      frontend_yml.dependencies = new_dependencies;

      for (const [service_key, service] of Object.entries(frontend_yml.services)) {
        if (service.environment) {
          const service_environment = await this.updateServiceEnvironmentDependencies(service.environment, backend_component_name);
          frontend_yml.services[service_key].environment = service_environment;
        }
      }
    }
    fs.writeFileSync(path.resolve(untildify(frontend_yml_path)), yaml.dump(frontend_yml));
  }

  private static generateSingleComponentReadme(name: string): string {
    return `# This project was auto-generated using the Architect CLI.
### To run your project locally:
Go into '${name}' and run the dev command.
  % architect dev .
### To deploy your project to the Cloud:
Go into '${name}', then run the register and deploy commands
  % architect register .
  % architect deploy ${name}`;
  }

  private static generateMultiCoponentReadme(root_service: string, secondary_service: string) {
    return `# This project was auto-generated using the Architect CLI.
### To run your project locally:
Go into '${secondary_service}', then run the link and link commands.
  % architect link .
Change directory to '../${root_service}' and run the dev command.
  % architect dev .
### To deploy your project to the Cloud:
Go into '${secondary_service}' and run the register command.
  % architect register .
Change directory to '../${root_service}', then run the register and deploy commands
  % architect register .
  % architect deploy ${root_service}`;
  }

  static async updateArchitectYamls(app: AppService, selections: Dictionary<any>, project_dir: string): Promise<void> {
    const backend = selections['backend'];
    const backend_yml_path = `./${project_dir}/${backend.name.toLowerCase()}/architect.yml`;
    const backend_yml = yaml.load(fs.readFileSync(backend_yml_path).toString('utf-8')) as ComponentSpec;
    const database_yml = await this.fetchYamlFromGitHub(selections['database']['architect-file']);
    await this.switchDatabase(database_yml, backend_yml, backend_yml_path);
    console.log(chalk.grey('# Why did we do this? Check out - https://docs.architect.io/components/services/\n'));

    // Need better handling for when a frontend requires a backend.
    const frontend = selections['frontend'];
    if (frontend) {
      const frontend_yml_path = `./${project_dir}/${frontend.name.toLowerCase()}/architect.yml`;
      const frontend_yml = yaml.load(fs.readFileSync(frontend_yml_path).toString('utf-8')) as ComponentSpec;
      const backend_component_name = backend ? backend.repository.split('/').pop() : undefined;
      await this.updateDependencies(frontend_yml, frontend_yml_path, backend_component_name);
    }

    let readme: string;
    if (!frontend && backend) {
      readme = this.generateSingleComponentReadme(backend.name.toLowerCase());
    } else {
      readme = this.generateMultiCoponentReadme(frontend.name.toLowerCase(), backend.name.toLowerCase());
    }
    fs.writeFileSync(`./${project_dir}/README.md`, readme);
  }

  static async getSelections(): Promise<Dictionary<Selection>> {
    // get choices from template-configs repository
    const config_file = 'https://raw.githubusercontent.com/architect-team/template-configs/main/config.json';
    const config_json = await this.fetchJsonFromGitHub(config_file) as Dictionary<any>;
    const choices = config_json.choices;

    const selections: Dictionary<Selection> = {};
    const types = ['Full stack', 'Backend'];
    const type = await this.prompt(types, 'What type of application are you building?');
    if (type.toLowerCase() === 'full stack') {
      const frontend_opts = choices.filter((item: any) => item.type === 'frontend');
      const frontend = await this.prompt(frontend_opts, 'Select a frontend');
      selections['frontend'] = frontend;
    }

    const backend_opts = choices.filter((item: any) => item.type === 'backend');
    const backend = await this.prompt(backend_opts, 'Select a backend');
    selections['backend'] = backend;

    const database_opts = choices.filter((item: any) => item.type === 'database');
    const database = await this.prompt(database_opts, 'Select a database');
    selections['database'] = database;

    return selections;
  }
}
