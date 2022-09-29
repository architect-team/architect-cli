import { Flags } from '@oclif/core';
import { Dictionary } from '../..';
import BaseCommand from '../../base-command';
import BaseTable from '../../base-table';
import { DockerComposeUtils } from '../../common/docker-compose';
import { DockerInspect } from '../../common/docker-compose/template';
import { RequiresDocker } from '../../common/docker/helper';

export default class DevList extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static flags = {
    format: Flags.string({
      char: 'f',
      description: `Format to output data in. Table or JSON`,
      default: 'table',
      options: ['TABLE', 'table', 'JSON', 'json'],
    }),
  };

  static description = 'List all running dev instances.';
  static examples = ['architect dev:list'];

  outputTable(local_env_map: Dictionary<DockerInspect[]>): void {
    const table = new BaseTable({ head: ['Environment', 'Containers', 'Status'] });

    for (const [env_name, containers] of Object.entries(local_env_map)) {
      const container_names = this.getContainerNames(containers).join('\n');
      const statuses = this.getContainerStates(containers).join('\n');
      table.push([env_name, container_names, statuses]);
    }
    if (!table.length) {
      this.log('There are no active dev instances yet. Use `architect dev` to create one.');
    } else {
      this.log(table.toString());
    }
  }

  getContainerStates(containers: DockerInspect[]): string[] {
    return containers.map(c => c.State.Status);
  }

  getContainerNames(containers: DockerInspect[]): string[] {
    // "Name" has a preceding '/' that we stripe
    return containers.map(c => c.Name.substring(1));
  }

  outputJSON(local_env_map: Dictionary<DockerInspect[]>): void {
    const output: Dictionary<any> = {};
    for (const [env_name, containers] of Object.entries(local_env_map)) {
      output[env_name] = {} as Dictionary<any>;
      const container_names = this.getContainerNames(containers);
      const statuses = this.getContainerStates(containers);
      for (let i = 0; i < container_names.length; i++) {
        output[env_name][container_names[i]] = {
          status: statuses[i],
        };
      }
    }
    this.log(JSON.stringify(output, null, 2));
  }

  @RequiresDocker({ compose: true })
  async run(): Promise<void> {
    const { args, flags } = await this.parse(DevList);

    const local_env_map = await DockerComposeUtils.getLocalEnvironmentContainerMap();
    if (flags.format.toLowerCase() === 'table') {
      this.outputTable(local_env_map);
    } else {
      this.outputJSON(local_env_map);
    }
  }
}
