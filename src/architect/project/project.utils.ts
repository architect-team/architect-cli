import fs from 'fs-extra';
import yaml from 'js-yaml';
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import { ComponentSpec } from '../../';
import { ServiceSpec } from '../../dependency-manager/spec/service-spec';

const download = require('download-git-repo');

interface GitHubRepo {
  name: string,
  full_name: string,
}

interface Selection {
  name: string,
  architect_yml: Dictionary<any>,
  depends_on: string,
}

const GITHUB_BRANCH = 'main';

class Queue<T> {
  items: any[];

  constructor(...params: any[]) {
    this.items = [...params];
  }

  enqueue(item: T) {
    this.items.push(item);
  }

  dequeue() {
    return this.items.shift();
  }

  getItems() {
    return this.items;
  }

  hasItem(key: string) {
    return this.items.some(item => item.hasOwnProperty(key));
  }

  size() {
    return this.items.length;
  }
}

export default class ProjectUtils {
  static queue = new Queue();
  static type_map: Dictionary<any> = {};
  static dependency_map: Dictionary<any> = {};
  static component_map: Dictionary<any> = {};

  static async getGitHubRepos(): Promise<GitHubRepo[]>{
    const res_json = await this.fetchJsonFromGitHub('https://api.github.com/orgs/architect-templates/repos');
    const repos = res_json.map((item: any) => {
      return {
        name: item.name,
        full_name: item.full_name,
      };
    });
    return repos;
  }

  static async getRepoFromGitHub(repo_name: string): Promise<GitHubRepo> {
    const github_repos = await this.getGitHubRepos();
    const repo = github_repos.find(item => item.name === repo_name.toLowerCase());
    if (!repo) {
      const repo_names = github_repos.map(repo => repo.name).join(', ');
      throw new Error(`Cannot find project '${repo_name}'. Available projects are: ${repo_names}.`);
    }
    return repo;
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

  static async storeComponentSpec(url: string, project_name: string): Promise<void> {
    const yaml_url = `${url}/architect.yml`;
    const component_spec = await this.fetchYamlFromGitHub(yaml_url);
    this.component_map[project_name.toLowerCase()] = component_spec;
  }

  static async storeTemplateContentToQueue(url: string, project_name: string): Promise<void> {
    const json_url = `${url}/architect-template.json`;
    const template_json = await this.fetchJsonFromGitHub(json_url) as Dictionary<any>;
    for (const [type, item] of Object.entries(template_json)) {
      if (item.required) {
        this.dependency_map[project_name] = type;
      }

      if (!this.queue.hasItem(type)) {
        this.queue.enqueue({ [type]: item });
      }
    }
  }

  static async getSelections(chosen_project: string): Promise<Dictionary<Selection>> {
    const start_project = await this.getRepoFromGitHub(chosen_project);

    const url = `https://raw.githubusercontent.com/${start_project.full_name}/${GITHUB_BRANCH}`;
    await this.storeComponentSpec(url, start_project.name);
    await this.storeTemplateContentToQueue(url, start_project.name);

    while (this.queue.size() > 0) {
      const item = this.queue.dequeue() as Dictionary<Dictionary<any>>;
      const proj_type = Object.keys(item)[0];
      const proj = item[proj_type];

      // check if type already prompted
      if (proj.choices) {
        const choice_names = proj.choices.map((choice: any) => choice.name.toLowerCase());
        const found = choice_names.find((choice_name: string) => Object.keys(this.component_map).includes(choice_name));
        if (found) {
          this.type_map[proj_type] = found;
          continue;
        }
      }

      let is_prompt = false;
      if (proj.required) { 
        is_prompt = true;
      } else {
        const answer = await this.prompt(['yes', 'no'], `${proj_type} is optional. Would you like to select a ` + proj_type.toLowerCase() + '?');
        is_prompt = answer === 'yes';
      }

      if (is_prompt) {
        const prompt_str = proj.required ? `This project requires a ${proj_type.toLowerCase()} to function, please select from the following` : `Select a ${proj_type.toLowerCase()}`;
        const selected = await this.prompt(proj.choices, prompt_str);
        this.type_map[proj_type] = selected.name.toLowerCase();

        if (!selected.project) {
          this.component_map[selected.name.toLowerCase()] = selected;
        } else {
          const url = selected.project.replace('github.com', 'raw.githubusercontent.com') + `/${GITHUB_BRANCH}`;
          await this.storeComponentSpec(url, selected.name);
          await this.storeTemplateContentToQueue(url, selected.name);
        }
      }
    }
    return this.combine_selections(this.type_map, this.dependency_map, this.component_map);
  }

  static combine_selections(type_map: Dictionary<any>, dependency_map: Dictionary<any>, component_map: Dictionary<any>): Dictionary<Selection> {
    const selections: Dictionary<Selection> = {};
    for (const [type, type_name] of Object.entries(type_map)) {
      const name = !component_map[type_name].architect_yml ? type_name : component_map[type_name].name;
      const architect_yml = !component_map[type_name].architect_yml ? component_map[type_name] : yaml.load(component_map[type_name].architect_yml.join('\n')) as Dictionary<any>;
      selections[type] = {
        name: name,
        architect_yml: architect_yml,
        depends_on: dependency_map[type_name] ? dependency_map[type_name] : '',
      };
    }

    // store any component spec that does not have a type by its name
    for (const [type_name, component_spec] of Object.entries(component_map)) {
      if (!(Object.values(type_map).includes(type_name))) {
        const spec = !component_spec.architect_yml ? component_spec : yaml.load(component_spec.architect_yml.join('\n')) as Dictionary<any>;
        selections[component_spec.name.toLowerCase()] = {
          name: component_spec.name,
          architect_yml: spec,
          depends_on: dependency_map[component_spec.name] ? dependency_map[component_spec.name] : '',
        };
      }
    }
    return selections;
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

  static async downloadRepo(url: string, dir_path: string): Promise<void> {
    await download(url + `#${GITHUB_BRANCH}`, dir_path, (err: any) => {
      if (err) {
        throw new Error(`Failed to download repository ${url}`);
      }
    });
  }

  static async downloadGitHubRepos(selections: Dictionary<Dictionary<any>>, project_dir: string): Promise<void> {
    // download any selection that has a homepage
    for (const selection of Object.values(selections)) {
      if (selection.architect_yml && selection.architect_yml.homepage) {
        const url = selection.architect_yml.homepage.replace('https://github.com/', '');
        await this.downloadRepo(url, project_dir + '/' + selection.name.toLowerCase());
      }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  static async createArchitectYaml(selections: Dictionary<any>, project_dir: string): Promise<void> {
    // get actual service name for depends_on
    for (const selection of Object.values(selections)) {
      if (selection.depends_on) {
        const depends_on_proj = selections[selection.depends_on];
        const services = depends_on_proj.architect_yml.services;
        if (Object.keys(services).length === 1) {
          selection.depends_on = Object.keys(services)[0];
        } else {
          const service_name = Object.keys(services).find((name: any) => !services[name].image);
          selection.depends_on = service_name;
        }
      }
    }

    const combined_yml: Dictionary<any> = {};
    combined_yml['name'] = project_dir.replace('_', '-');
    const ignored = ['name', 'description', 'homepage', 'keywords'];
    for (const selection of Object.values(selections)) {
      for (const [key, val] of Object.entries(selection.architect_yml as ComponentSpec)) {
        if (ignored.includes(key)) {
          continue;
        }

        if (key !== 'services') {
          combined_yml[key] = combined_yml[key] ? { ...combined_yml[key], ...val } : val;
          continue;
        }

        const yml_services = val as Dictionary<ServiceSpec>;
        const service_keys = Object.keys(yml_services);
        if (service_keys.length === 1) {
          const service_key = service_keys[0];
          const service = yml_services[service_key];
          if (service.build) {
            service.build['context'] = './' + selection.name;
          }
          if (selection.depends_on) {
            yml_services[service_key]['depends_on'] = [selection.depends_on];
          }
          combined_yml[key] = combined_yml[key] ? { ...combined_yml[key], ...yml_services } : yml_services;
        } else {
          for (const [service_name, service] of Object.entries(yml_services)) {
            if (service.build && !service.image) {
              combined_yml[key] = combined_yml[key] ? { ...combined_yml[key], ...{ [service_name]: service } } : { [service_name]: service };
              service.build['context'] = './' + selection.name;
              if (selection.depends_on) {
                combined_yml[key][service_name]['depends_on'] = [selection.depends_on];
              }
            }
          }
        }
      }
    }

    const app_key = Object.keys(combined_yml['interfaces']).find(key => key === 'app');
    if (app_key) {
      combined_yml['interfaces'] = { [app_key]: combined_yml['interfaces'][app_key] };
    } else {
      const key = Object.keys(combined_yml['interfaces'])[0];
      combined_yml['interfaces'] = { [key]: combined_yml['interfaces'][key] };
    }
    
    fs.writeFileSync('./' + project_dir + '/architect.yml', yaml.dump(combined_yml));
  }
}
