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

  static async getGitHubRepos(url: string): Promise<GitHubRepo[]>{
    const res_json = await this.fetchJsonFromGitHub('https://api.github.com/orgs/architect-templates/repos');
    const repos = res_json.map((item: any) => {
      return {
        name: item.name,
        full_name: item.full_name,
      };
    });
    return repos;
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

  static async getSelections(chosen_project: string): Promise<Dictionary<Selection>> {
    const queue = new Queue();
    const type_map: Dictionary<any> = {};
    const dependency_map: Dictionary<any> = {};
    const component_map: Dictionary<any> = {};

    // find project repository in our GitHub
    const github_repos = await this.getGitHubRepos('https://api.github.com/orgs/architect-templates/repos');
    const start_project = github_repos.find(repo => repo.name === chosen_project.toLowerCase());
    if (!start_project) {
      const repo_names = github_repos.map(repo => repo.name).join(', ');
      throw new Error(`Cannot find project '${chosen_project}'. Available projects are: ${repo_names}.`);
    }

    // store component spec of the chosen project
    const yaml_url = 'https://raw.githubusercontent.com/' + start_project.full_name + `/${GITHUB_BRANCH}/architect.yml`;
    const component_spec = await this.fetchYamlFromGitHub(yaml_url);
    component_map[start_project.name.toLowerCase()] = component_spec;

    // store architect-template.json content
    const url = 'https://raw.githubusercontent.com/' + start_project.full_name + `/${GITHUB_BRANCH}/architect-template.json`;
    const template_json = await this.fetchJsonFromGitHub(url) as Dictionary<any>;
    for (const [type, item] of Object.entries(template_json)) {
      if (item.required) {
        dependency_map[start_project.name] = type;
      }

      if (!queue.hasItem(type)) {
        queue.enqueue({ [type]: item });
      }
    }

    while (queue.size() > 0) {
      const item = queue.dequeue() as Dictionary<Dictionary<any>>;
      const proj_type = Object.keys(item)[0];
      const proj = item[proj_type];

      // check if that type was already asked
      if (proj.choices) {
        const choice_names = proj.choices.map((choice: any) => choice.name.toLowerCase());
        const found = choice_names.find((choice_name: string) => Object.keys(component_map).includes(choice_name));
        if (found) {
          type_map[proj_type] = found;
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
        const selected = await this.prompt(proj.choices, 'Select a ' + proj_type.toLowerCase());
        type_map[proj_type] = selected.name.toLowerCase();

        if (!selected.project) {
          component_map[selected.name.toLowerCase()] = selected;
        } else {
          // store component spec
          const yaml_url = selected.project.replace('github.com', 'raw.githubusercontent.com') + `/${GITHUB_BRANCH}/architect.yml`;
          const component_spec = await this.fetchYamlFromGitHub(yaml_url);
          component_map[selected.name.toLowerCase()] = component_spec;

          // store template content
          const url = selected.project.replace('github.com', 'raw.githubusercontent.com') + `/${GITHUB_BRANCH}/architect-template.json`;
          const template_json = await this.fetchJsonFromGitHub(url) as Dictionary<any>;
          for (const [type, item] of Object.entries(template_json)) {
            if (item.required) {
              dependency_map[selected.name.toLowerCase()] = type;
            }

            if (!queue.hasItem(type)) {
              queue.enqueue({ [type]: item });
            }
          }
        }
      }
    }

    // combine type_map and component_map
    const selections: Dictionary<Selection> = {};
    for (const [type, type_name] of Object.entries(type_map)) {
      const dependency = dependency_map[type_name] ? dependency_map[type_name] : '';
      
      if (!component_map[type_name].architect_yml) {
        selections[type] = {
          name: type_name,
          architect_yml: component_map[type_name],
          depends_on: dependency,
        };
      } else {
        selections[type] = {
          name: component_map[type_name].name,
          architect_yml: yaml.load(component_map[type_name].architect_yml.join('\n')) as Dictionary<any>,
          depends_on: dependency,
        };
      }
    }

    // store any component spec that does not have a type by its name
    for (const [type_name, component_spec] of Object.entries(component_map)) {
      if (!(Object.values(type_map).includes(type_name))) {
        const dependency = dependency_map[component_spec.name] ? dependency_map[component_spec.name] : '';
        
        if (!component_spec.architect_yml) {
          selections[component_spec.name.toLowerCase()] = {
            name: component_spec.name,
            architect_yml: component_spec,
            depends_on: dependency,
          };
        } else {
          selections[component_spec.name.toLowerCase()] = {
            name: component_spec.name,
            architect_yml: yaml.load(component_spec.architect_yml.join('\n')) as Dictionary<any>,
            depends_on: dependency,
          };
        }
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
        const keys = Object.keys(yml_services);
        if (keys.length === 1) {
          const service_key = keys[0];
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
