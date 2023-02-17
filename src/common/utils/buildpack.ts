import chalk from 'chalk';
import * as fs from 'fs-extra';
import path from 'path';
import { ServiceNode, TaskNode } from '../..';
import { BuildConfig } from '../../dependency-manager/config/resource-config';
import { DependencyGraphMutable } from '../../dependency-manager/graph';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import { DockerUtils } from '../docker';
import BuildpackPlugin from '../plugins/buildpack-plugin';
import PluginManager from '../plugins/plugin-manager';

export default class BuildPackUtils {
  public static useBuildPack(local_path?: string, build?: BuildConfig): boolean {
    if (!local_path || !build) {
      return false;
    }
    const component_path = path.resolve(fs.lstatSync(local_path).isFile() ? path.dirname(local_path) : local_path);
    const dockerfile_exist = DockerUtils.doesDockerfileExist(path.join(component_path, build.context || '.'), build.dockerfile);
    return build.buildpack || !dockerfile_exist;
  }

  private static async createProcfile(context: string, command: string): Promise<void> {
    const procfile_backup_location = path.join(context, '/Procfile.backup');
    const procfile_location = path.join(context, '/Procfile');
    const does_exist = await fs.pathExists(procfile_location);
    const does_exist_backup = await fs.pathExists(procfile_backup_location);
    // If a backup exists do not overwite it. The backup is most likely the original.
    if (does_exist_backup) {
      await fs.remove(procfile_location);
    } else if (does_exist) {
      await fs.move(procfile_location, procfile_backup_location);
    }
    await fs.writeFile(procfile_location, `architect: ${command}`);
  }

  private static async cleanupProcfile(context: string): Promise<void> {
    const procfile_backup_location = path.join(context, '/Procfile.backup');
    const procfile_location = path.join(context, '/Procfile');
    const does_exist = await fs.pathExists(procfile_location);
    const does_exist_backup = await fs.pathExists(procfile_backup_location);
    if (does_exist) {
      await fs.remove(procfile_location);
    }
    if (does_exist_backup) {
      const contents = (await fs.readFile(procfile_backup_location)).toString();
      console.log(contents);
      if (contents.indexOf('architect:') === 0) {
        await fs.remove(procfile_backup_location);
      } else {
        await fs.move(procfile_backup_location, procfile_location);
      }
    }
  }

  public static async build(config_directory: string, image_name: string, command?: string, path?: string): Promise<void> {
    console.log(chalk.blue(`(Experimental) Begin building buildpack image ${image_name}. To use a Dockerfile instead please check out documentation here https://docs.architect.io/components/services/#build`));
    const buildpack_plugin = await PluginManager.getPlugin(config_directory, BuildpackPlugin);
    try {
      if (command) {
        await this.createProcfile(path || '.', command);
      }
      await buildpack_plugin.build(image_name, path);
      if (command) {
        await this.cleanupProcfile(path || '.');
      }
    } catch (error) {
      console.log(error);
      throw new ArchitectError(`Buildpack failed to build ${image_name}. If you are unsure what the buildpack error is, we recommend trying to use a Dockerfile instead https://docs.architect.io/components/services/#build`);
    }
  }

  public static async buildGraph(config_directory: string, graph: Readonly<DependencyGraphMutable>): Promise<string[]> {
    const node_refs: string[] = [];
    for (const node of graph.nodes.filter(node => !node.is_external)) {
      if (!(node instanceof ServiceNode || node instanceof TaskNode)) {
        continue;
      }
      if (BuildPackUtils.useBuildPack(node.local_path, node.config.build)) {
        await BuildPackUtils.build(config_directory, node.ref, node.config.command?.join(' '), node.config.build?.context);
        node_refs.push(node.ref);
      }
    }
    return node_refs;
  }
}
