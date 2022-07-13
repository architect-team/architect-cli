import yaml from 'js-yaml';
import fetch from 'node-fetch';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import { ComponentSpec } from '../../';

interface GitHubRepo {
  name: string,
  full_name: string,
}

class Queue<T> {
  items: T[];

  constructor(...params: T[]) {
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
    return this.items.some(item => Object.keys(item)[0] === key);
  }

  size() {
    return this.items.length;
  }
}

export class ProjectGeneration {
  queue: Queue<Dictionary<Dictionary<any>>>;
  type_map: Dictionary<any>;
  dependency_map: Dictionary<any>;
  component_map: Dictionary<any>;

  constructor() {
    this.queue = new Queue();
    this.type_map = {};
    this.dependency_map = {};
    this.component_map = {};
  }

  async getGitHubRepos(): Promise<GitHubRepo[]> {
    const res_json = await this.fetchJsonFromGitHub('https://api.github.com/orgs/architect-templates/repos');
    const repos = res_json.map((item: any) => {
      return {
        name: item.name,
        full_name: item.full_name,
      };
    });
    return repos;
  }

  async getGitHubRepo(repo_name: string): Promise<GitHubRepo> {
    const github_repos = await this.getGitHubRepos();
    const repo = github_repos.find(item => item.name === repo_name.toLowerCase());
    if (!repo) {
      const repo_names = github_repos.map(repo => repo.name).join(', ');
      throw new Error(`Cannot find project '${repo_name}'. Available projects are: ${repo_names}.`);
    }
    return repo;
  }

  async fetchJsonFromGitHub(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }
    return await response.json();
  }

  async fetchYamlFromGitHub(url: string): Promise<ComponentSpec> {
    const component_spec = await fetch(url)
      .then((res: any) => res.blob())
      .then((blob: any) => blob.text())
      .then((yaml_as_string: any) => yaml.load(yaml_as_string) as ComponentSpec)
      .catch((err: any) => {
        throw new Error(`Failed to fetch ${url}`);
      });
    return component_spec;
  }

  async storeComponentSpec(url: string, project_name: string): Promise<void> {
    const yaml_url = `${url}/architect.yml`;
    const component_spec = await this.fetchYamlFromGitHub(yaml_url);
    this.component_map[project_name.toLowerCase()] = component_spec;
  }

  async storeTemplateContentToQueue(url: string, project_name: string): Promise<void> {
    const json_url = `${url}/architect-template.json`;
    const template_json = await this.fetchJsonFromGitHub(json_url) as Dictionary<any>;
    for (const [type, item] of Object.entries(template_json)) {
      if (item.required) {
        this.dependency_map[project_name.toLowerCase()] = type;
      }

      if (!this.queue.hasItem(type)) {
        this.queue.enqueue({ [type]: item });
      }
    }
  }
}
