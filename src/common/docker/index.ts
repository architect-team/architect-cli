import fs from 'fs-extra';
import path from 'path';
import { ArchitectError } from '../../dependency-manager/utils/errors';

export class DockerUtils {
  public static doesDockerfileExist(context: string, dockerfile: string | undefined): boolean {
    if (!dockerfile) {
      return fs.existsSync(path.join(context, 'Dockerfile'));
    }

    if (!fs.existsSync(path.join(context, dockerfile))) {
      throw new ArchitectError(`${path.join(context, dockerfile)} does not exist. Please verify the correct context and/or dockerfile were given.`);
    }
    return true;
  }
}
