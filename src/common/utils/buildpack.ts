import chalk from 'chalk';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import BuildpackPlugin from '../plugins/buildpack-plugin';
import PluginManager from '../plugins/plugin-manager';

export default class BuildPackUtils {
  public static async build(config_directory: string, image_name: string, path: string | undefined): Promise<void> {
    console.log(chalk.blue(`Begin building buildpack image ${image_name}`));
    const buildpack_plugin = await PluginManager.getPlugin(config_directory, BuildpackPlugin);
    try {
      await buildpack_plugin.build(image_name, path);
    } catch (error) {
      throw new ArchitectError(`Buildpack failed to build ${image_name}. If you are unsure what the buildpack error is, we recommend trying to use a Dockerfile instead https://docs.architect.io/components/services/#build`);
    }
  }
}
