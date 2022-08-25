import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { buildSpecFromPath, ComponentSpec } from '../../';
import AppService from '../../app-config/service';
import { EnvironmentSpecValue } from '../../dependency-manager/spec/resource-spec';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import axios from 'axios';
import execa from 'execa';

interface Selection {
  name: string,
  type: string,
  repository?: string,
  'architect-file'?: string,
}

export default class ProjectUtils {

  private static getRootComponent(selections: Dictionary<Selection>): string {
    if (selections.frontend) {
      return selections.frontend.name.toLowerCase();
    } else if (selections.backend) {
      return selections.backend.name.toLowerCase();
    }
    return '';
  }

  static linkSelections(app: AppService, selections: Dictionary<Selection>, project_name: string): void {
    for (const selection of Object.values(selections)) {
      if (selection.type.toLowerCase() == 'database') {
        continue;
      }
      const key = selection.name.toLowerCase();
      const component_path = path.join(project_name, key, 'architect.yml');
      const component_config = buildSpecFromPath(component_path);
      console.log(`Linking ${key} with architect cli so it can be used as a dependency.`);
      console.log(`% architect link ${component_path}`);
      app.linkComponentPath(component_config.name, component_path);
    }
    const root_path = path.join(project_name, this.getRootComponent(selections), 'architect.yml');
    console.log(`\nTry running your project now: \`architect dev ${root_path}\`\n`);
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
    // download any selection that has a repository
    for (const selection of Object.values(selections)) {
      if (selection.repository) {
        await execa('git', ['clone', selection.repository, project_dir + '/' + selection.name.toLowerCase()]);
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
    this.switchDatabase(database_yml, backend_yml, backend_yml_path);

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
