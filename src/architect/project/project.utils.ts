import fs from 'fs-extra';
import yaml from 'js-yaml';
import inquirer from 'inquirer';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import { ComponentSpec } from '../../';
import { ServiceSpec } from '../../dependency-manager/spec/service-spec';
import { ProjectGeneration } from '../../common/project-generation';
import { EnvironmentSpecValue } from '../../dependency-manager/spec/resource-spec';

const download = require('download-git-repo');

interface Selection {
  name: string,
  architect_yml: Dictionary<any>,
  depends_on: string,
}

const GITHUB_BRANCH = 'main';

export default class ProjectUtils {
  static async getSelections(chosen_project?: string): Promise<Dictionary<Selection>> {
    const project_generation = new ProjectGeneration();

    if (!chosen_project) {
      const choices = await project_generation.getGitHubRepos();
      const project = await this.prompt(choices, 'Select a project');
      chosen_project = project.name as string;
    }
    
    const start_project = await project_generation.getGitHubRepo(chosen_project);

    const url = `https://raw.githubusercontent.com/${start_project.full_name}/${GITHUB_BRANCH}`;
    await project_generation.storeComponentSpec(url, start_project.name);
    await project_generation.storeTemplateContentToQueue(url, start_project.name);

    while (project_generation.queue.size() > 0) {
      const item = project_generation.queue.dequeue() as Dictionary<Dictionary<any>>;
      const proj_type = Object.keys(item)[0];
      const proj = item[proj_type];

      // check if type already prompted
      if (proj.choices) {
        const choice_names = proj.choices.map((choice: any) => choice.name.toLowerCase());
        const found = choice_names.find((choice_name: string) => Object.keys(project_generation.component_map).includes(choice_name));
        if (found) {
          project_generation.type_map[proj_type] = found;
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
        project_generation.type_map[proj_type] = selected.name.toLowerCase();

        if (!selected.project) {
          project_generation.component_map[selected.name.toLowerCase()] = selected;
        } else {
          const url = selected.project.replace('github.com', 'raw.githubusercontent.com') + `/${GITHUB_BRANCH}`;
          await project_generation.storeComponentSpec(url, selected.name);
          await project_generation.storeTemplateContentToQueue(url, selected.name);
        }
      }
    }
    return this.combine_selections(project_generation.type_map, project_generation.dependency_map, project_generation.component_map);
  }

  static combine_selections(type_map: Dictionary<any>, dependency_map: Dictionary<any>, component_map: Dictionary<any>): Dictionary<Selection> {
    const selections: Dictionary<Selection> = {};
    for (const [type, type_name] of Object.entries(type_map)) {
      const name = !component_map[type_name].architect_yml ? type_name : component_map[type_name].name;
      const spec = !component_map[type_name].architect_yml ? component_map[type_name] : yaml.load(component_map[type_name].architect_yml.join('\n')) as Dictionary<any>;
      selections[type] = {
        name: name,
        architect_yml: spec,
        depends_on: dependency_map[type_name.toLowerCase()] ? dependency_map[type_name.toLowerCase()] : '',
      };
    }

    // store any component spec that does not have a type by its name
    for (const [type_name, component_spec] of Object.entries(component_map)) {
      if (!(Object.values(type_map).includes(type_name))) {
        const spec = !component_spec.architect_yml ? component_spec : yaml.load(component_spec.architect_yml.join('\n')) as Dictionary<any>;
        const name = component_spec.name.toLowerCase();
        selections[component_spec.name.toLowerCase()] = {
          name: component_spec.name,
          architect_yml: spec,
          depends_on: dependency_map[name] ? dependency_map[name] : '',
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

  static async removeServiceEnvironmentDependencies(service_environment: Dictionary<EnvironmentSpecValue>): Promise<Dictionary<EnvironmentSpecValue>> {
    const dependencies_regex = new RegExp('dependencies[[A-Za-z\'-_].*\'].', 'g');
    for (const [env_key, env_val] of Object.entries(service_environment)) {
      if (typeof env_val === 'string' && env_val.includes('dependencies')) {
        const matches = dependencies_regex.exec(env_val);
        if (matches) {
          service_environment[env_key] = env_val.replace(matches[0], '');
        }
      }
    }
    return service_environment;
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
    const ignored = ['name', 'description', 'homepage', 'keywords', 'dependencies'];
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
        for (const [service_name, service] of Object.entries(yml_services)) {
          if (Object.keys(yml_services).length > 1 && service.image) {
            continue;
          }

          combined_yml[key] = combined_yml[key] ? { ...combined_yml[key], ...{ [service_name]: service } } : { [service_name]: service };
          if (service.build) {
            service.build['context'] = './' + selection.name;
          }
          if (selection.depends_on && service_name !== selection.depends_on) {
            const depends_on = service['depends_on'] ? [...service['depends_on'], selection.depends_on] : [selection.depends_on];
            combined_yml[key][service_name]['depends_on'] = depends_on;
          }
          if (service.environment) {
            service.environment = await this.removeServiceEnvironmentDependencies(service.environment);
          }
        }
      }
    }
    
    fs.writeFileSync('./' + project_dir + '/architect.yml', yaml.dump(combined_yml));
  }
}
