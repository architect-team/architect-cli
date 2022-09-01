import BaseCommand from '../../base-command';
import BaseTable from '../../base-table';
import { DockerComposeUtils } from '../../common/docker-compose';

export default class DevList extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'List all running dev instances.';
  static examples = ['architect link:list'];

  async run(): Promise<void> {
    const local_env_map = await  DockerComposeUtils.getLocalEnvironmentContainerMap();
    const table = new BaseTable({ head: ['Environment', 'Containers', 'Status'] });

    for (const [env_name, containers] of Object.entries(local_env_map)) {
      const container_names = containers.map(c => {
        if ('com.docker.compose.service' in c.Config.Labels) {
          return c.Config.Labels['com.docker.compose.service'];
        }
        // Fallback in case compose label isn't present for some reason - this is the image name
        return c.Name;
      }).join('\n');
      const statuses = containers.map(c => c.State.Status).join('\n');
      table.push([env_name, container_names, statuses]);
    }

    this.log(table.toString());
  }
}
