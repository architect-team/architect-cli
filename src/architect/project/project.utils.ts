import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import fetch from 'node-fetch';
import inquirer from 'inquirer';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import { ComponentSpec } from '../../';
import { EnvironmentSpecValue } from '../../dependency-manager/spec/resource-spec';
import AppService from '../../app-config/service';

const download = require('download-git-repo');

interface Selection {
  name: string,
  type: string,
  repository?: string,
  'architect-file'?: string,
}

const GITHUB_BRANCH = 'main';

export default class ProjectUtils {
  static readme: string[] = [];

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
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return await response.json();
  }

  static async fetchYamlFromGitHub(url: string): Promise<ComponentSpec> {
    const component_spec = await fetch(url)
      .then((res: any) => res.blob())
      .then((blob: any) => blob.text())
      .then((yaml_as_string: any) => yaml.load(yaml_as_string) as ComponentSpec)
      .catch((err: any) => {
        throw new Error(`Failed to fetch ${url}`);
      });
    return component_spec;
  }

  static async downloadRepo(url: string, dir_path: string): Promise<void> {
    await download(url + `#${GITHUB_BRANCH}`, dir_path, (err: any) => {
      if (err) {
        throw new Error(`Failed to download repository ${url}`);
      }
    });
  }

  static async downloadGitHubRepos(selections: Dictionary<Dictionary<any>>, project_dir: string): Promise<void> {
    // download any selection that has a repository
    for (const selection of Object.values(selections)) {
      if (selection.repository) {
        const url = selection.repository.replace('https://github.com/', '');
        await this.downloadRepo(url, project_dir + '/' + selection.name.toLowerCase());
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

  static switchDatabase(database_yml: ComponentSpec, backend_yml: ComponentSpec, backend_yml_path: string): void {
    if (!backend_yml.services || !database_yml.services) {
      return;
    }
    
    for (const [service_key, service] of Object.entries(backend_yml.services)) {
      if (service.image) {
        backend_yml.secrets = { ...backend_yml.secrets, ...database_yml.secrets };
        backend_yml.services[service_key] = Object.values(database_yml.services)[0];
        fs.writeFileSync(path.resolve(untildify(backend_yml_path)), yaml.dump(backend_yml));
      }
    }
  }

  static async updateDependencies(frontend_yml: ComponentSpec, frontend_yml_path: string, backend_component_name: string): Promise<void> {
    if (!frontend_yml.dependencies) {
      return;
    }

    if (frontend_yml.dependencies && frontend_yml.services) {
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

  static async updateArchitectYamls(app: AppService, selections: Dictionary<any>, project_dir: string): Promise<void> {
    const backend = selections['backend'];
    const backend_yml_path = `./${project_dir}/${backend.name.toLowerCase()}/architect.yml`;
    const backend_yml = yaml.load(fs.readFileSync(backend_yml_path).toString('utf-8')) as ComponentSpec;
    const database_yml = await this.fetchYamlFromGitHub(selections['database']['architect-file']);
    this.switchDatabase(database_yml, backend_yml, backend_yml_path);

    const frontend = selections['frontend'];
    const frontend_yml_path = `./${project_dir}/${frontend.name.toLowerCase()}/architect.yml`;
    const frontend_yml = yaml.load(fs.readFileSync(frontend_yml_path).toString('utf-8')) as ComponentSpec;
    const backend_component_name = backend.repository.split('/').pop();
    await this.updateDependencies(frontend_yml, frontend_yml_path, backend_component_name);

    // create readme file
    this.readme.push('# This project was auto-generated using the Architect CLI.\n');

    this.readme.push(`### To run your project locally:`);
    this.readme.push(`Go into '${backend.name.toLowerCase()}' and run the link command.`);
    this.readme.push('  % architect link .\n');
    this.readme.push(`Change directory to '../${frontend.name.toLowerCase()}', then run the link and dev commands.`);
    this.readme.push('  % architect link .');
    this.readme.push('  % architect dev .\n');

    this.readme.push(`### To deploy your project to the Cloud:`);
    this.readme.push(`Go into '${backend.name.toLowerCase()}' and run the register command.`);
    this.readme.push('  % architect register .\n');
    this.readme.push(`Change directory to '../${frontend.name.toLowerCase()}', then run the register and deploy commands`);
    this.readme.push('  % architect register .');
    this.readme.push(`  % architect deploy ${frontend.name.toLowerCase()}\n`);
    fs.writeFileSync(`./${project_dir}/README.md`, this.readme.join('\n'));
  }

  static async getSelections(chosen_project?: string): Promise<Dictionary<Selection>> {
    // get choices from template-configs repository
    const config_file = 'https://raw.githubusercontent.com/architect-team/template-configs/main/config.json';
    const config_json = await this.fetchJsonFromGitHub(config_file) as Dictionary<any>;
    const choices = config_json.choices;
    
    const selections: Dictionary<Selection> = {};
    const types = ['Frontend', 'Backend', 'Full stack'];
    const type = await this.prompt(types, 'Select a type you would like to proceed');
    if (type.toLowerCase() === 'frontend' || type.toLowerCase() === 'full stack') {
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
