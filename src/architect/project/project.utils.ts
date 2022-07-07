import fs from 'fs-extra';
import yaml from 'js-yaml';
import inquirer from 'inquirer';
import fetch from 'node-fetch';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import { buildSpecFromPath, ComponentSpec } from '../../';
import { ServiceSpec } from '../../dependency-manager/spec/service-spec';

const download = require('download-git-repo');

interface ProjectRepo{
  name: string,
  project: string,
}

interface Image {
  name: string,
  image: string,
}

enum INFRASTRUCTURE {
  FRONTEND = 'Frontend',
  BACKEND = 'Backend',
}

const FRONTENDS = [
  {
    'name': 'React',
    'project': 'https://github.com/architect-templates/react',
  },
  {
    'name': 'Nuxt',
    'project': 'https://github.com/architect-templates/nuxt',
  },
];

const BACKENDS = [
  {
    'name': 'NodeJS',
    'project': 'https://github.com/architect-templates/node-rest-api',
  },
  {
    'name': 'Django',
    'project': 'https://github.com/architect-templates/django',
  },
  {
    'name': 'Flask',
    'project': 'https://github.com/architect-templates/flask',
  },
  {
    'name': 'NestJS',
    'project': 'https://github.com/architect-templates/nestjs',
  },
];

export default class ProjectUtils {

  static async getDatabaseService(db_name: string): Promise<string> {
    switch (db_name) {
      case 'postgres':
        return `
        image: postgres:latest
        interfaces:
          database:
            port: \${{ secrets.db_port }}
            protocol: postgresql
        environment:
          POSTGRES_USER: \${{ secrets.db_user }}
          POSTGRES_PASSWORD: \${{ secrets.db_pass }}
          POSTGRES_DB: \${{ secrets.db_name }}
        `;
      case 'mysql':
        return `
          image: mysql:latest
          interfaces:
            database:
              port: 3306
              username: \${{ secrets.db_user }}
              password: \${{ secrets.db_pass }}
              protocol: mysql
              path: /\${{ secrets.db_name }}
          environment:
            MYSQL_ROOT_PASSWORD: \${{ secrets.db_pass }}
            MYSQL_DATABASE: \${{ secrets.db_name } }
        `;
      case 'mariadb':
        return `
          image: mariadb:latest
          interfaces:
            database:
              port: 3306
              username: \${{ secrets.db_user }}
              password: \${{ secrets.db_pass }}
              protocol: mysql
              path: /\${{ secrets.db_name }}
          environment:
            MYSQL_ROOT_PASSWORD: \${{ secrets.db_pass }}
            MYSQL_DATABASE: \${{ secrets.db_name } }
        `;
      default:
        throw new Error(`Database ${db_name} is not supported.`);
    }
  }
  
  static async promptInfrastructure(): Promise<string> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
    const answers: any = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'infrastructure',
        message: 'Select an infrastructure',
        source: async (answers_so_far: any, input: string) => {
          return [INFRASTRUCTURE.FRONTEND, INFRASTRUCTURE.BACKEND];
        },
      },
    ]);
    return answers.infrastructure;
  }

  static async prompt(choices: ProjectRepo[] | Image[], message: string): Promise<ProjectRepo | Image> {
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
    const answers: { projectRepo: ProjectRepo | Image } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'projectRepo',
        message: message,
        source: async (answers_so_far: any, input: string) => {
          return choices.map((p) => ({ name: p.name, value: p }));
        },
      },
    ]);
    return answers.projectRepo;
  }

  static async downloadRepo(url: string, dir_path: string): Promise<void> {
    await download(url + '#main', dir_path, (err: any) => {
      if (err) {
        throw new Error(`Failed to download repository ${url}`);
      }
    });
  }

  static async downloadGitHubRepos(selections: Dictionary<any>, project_dir: string): Promise<void> {
    const frontend = selections[INFRASTRUCTURE.FRONTEND.toLowerCase()];
    if (frontend) {
      const url = frontend['project'].replace('https://github.com/', '');
      await this.downloadRepo(url, project_dir + '/' + frontend['name'].toLowerCase());
    }

    const backend = selections[INFRASTRUCTURE.BACKEND.toLowerCase()];
    const url = backend['project'].replace('https://github.com/', '');
    const backend_path = !frontend ? project_dir : project_dir + '/' + backend['name'].toLowerCase();
    await this.downloadRepo(url, backend_path);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  static async createNewArchitectYaml(selections: Dictionary<any>, project_dir: string): Promise<void> {
    if (!selections.hasOwnProperty(INFRASTRUCTURE.FRONTEND.toLowerCase())) {
      return;
    }
    
    // services
    let backend_service_name = '';
    const backend = selections[INFRASTRUCTURE.BACKEND.toLowerCase()];
    const backend_spec = buildSpecFromPath(project_dir + '/' + backend['name'].toLowerCase());
    for (const [service_name, service] of Object.entries(backend_spec.services as Dictionary<ServiceSpec>)) {
      if (service.build && !service.image) {
        service.build['context'] = './' + backend['name'].toLowerCase();
        backend_service_name = service_name;
      } else {
        const selected_db = selections['database']['image'];
        if (!service.image?.toLowerCase().includes(selections['database']['image'])) {
          const db_service_yml = yaml.load(await this.getDatabaseService(selected_db)) as ServiceSpec;
          service.image = db_service_yml.image;
          service.interfaces = db_service_yml.interfaces;
          service.environment = db_service_yml.environment;
        }
      }
    }

    const frontend = selections[INFRASTRUCTURE.FRONTEND.toLowerCase()];
    const frontend_spec = buildSpecFromPath(project_dir + '/' + frontend['name'].toLowerCase());
    for (const service of Object.values(frontend_spec.services as Dictionary<ServiceSpec>)) {
      if (service.build && !service.image) {
        service.build['context'] = './' + frontend['name'].toLowerCase();
        service['depends_on'] = [backend_service_name];
      }
    }

    // combine yaml files
    const component_name: string = frontend['name'].toLowerCase() + '-' + backend['name'.toLowerCase()];
    const homepage = frontend_spec.homepage + ' and ' + backend_spec.homepage;
    const yml = {
      'name': component_name.toLowerCase(),
      'homepage': homepage,
      'secrets': { ...backend_spec.secrets, ...frontend_spec.secrets },
      'dependencies': frontend_spec.dependencies,
      'services': { ...backend_spec.services, ...frontend_spec.services },
      'interfaces': frontend_spec.interfaces,
    } as ComponentSpec;

    fs.writeFileSync('./' + project_dir + '/architect.yml', yaml.dump(yml));
  }

  static async readArchitectTemplateJSON(github_repo_url: string): Promise<Dictionary<Dictionary<any>>> {
    const url = github_repo_url.replace('github.com', 'raw.githubusercontent.com') + '/main/architect-template.json';
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }
    return await response.json();
  }

  static async getSelections(chosen_project?: string): Promise<Dictionary<any>>{
    const selections: Dictionary<any> = {};
    if (!chosen_project) {
      const infrastructure = await this.promptInfrastructure();
      let backend_choices = BACKENDS as ProjectRepo[];

      let frontend: any;
      if (infrastructure === INFRASTRUCTURE.FRONTEND) {
        frontend = await this.prompt(FRONTENDS, 'Select a frontend');
        selections['frontend'] = frontend;
        const json_content = await this.readArchitectTemplateJSON(frontend.project);
        backend_choices = json_content[INFRASTRUCTURE.BACKEND.toLowerCase()]['choices'] as ProjectRepo[];
      }

      const backend = await this.prompt(backend_choices, 'This project requires a backend API to function, please pick from the following');
      selections['backend'] = backend;
    } else {
      const frontend = FRONTENDS.find(item => item.name.toLowerCase() === chosen_project.toLowerCase());
      let backend = BACKENDS.find(item => item.name.toLowerCase() === chosen_project.toLowerCase());
      if (!frontend && !backend) {
        const err_msg = `The selected project '${chosen_project}' is not supported.\n  `;
        const supported_frontends = FRONTENDS.map(item => item.name).join(', ');
        const supported_backends = BACKENDS.map(item => item.name).join(', ');
        throw new Error(err_msg + `Supported frontends: ${supported_frontends}\n  Supported backends:  ${supported_backends}`);
      }
      
      if (frontend) {
        selections['frontend'] = frontend;
        const json_content = await this.readArchitectTemplateJSON(frontend.project);
        const backend_choices = json_content[INFRASTRUCTURE.BACKEND.toLowerCase()]['choices'] as ProjectRepo[];
        backend = await this.prompt(backend_choices, 'This project requires a backend API to function, please pick from the following') as ProjectRepo;
      }
      selections['backend'] = backend;
    }

    // prompt database
    const json_content = await this.readArchitectTemplateJSON(selections[INFRASTRUCTURE.BACKEND.toLowerCase()].project);
    if (json_content['database']['required']) {
      const choices = json_content['database']['choices'] as Image[];
      const database = await this.prompt(choices, 'Your backend project requires a database to function, please pick from the following');
      selections['database'] = database;
    }

    return selections;
  }
}
