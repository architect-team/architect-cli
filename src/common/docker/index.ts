import fs from 'fs-extra';
import path from 'path';
import { ArchitectError } from '../../dependency-manager/utils/errors';
import { docker } from './cmd';
import { RequiresDocker } from './helper';

export interface DockerImage {
  name: string;
  ref: string;
}

export class DockerUtils {
  @RequiresDocker()
  public static async pushImagesToRegistry(images: DockerImage[]): Promise<void> {
    for (const image of images) {
      await docker(['tag', `${image.name}:latest`, image.ref]);
      await docker(['push', image.ref]);
    }
  }

  public static async doesDockerfileExist(context: string, dockerfile: string | undefined) {
    if (!dockerfile) {
      return fs.existsSync(path.join(context, 'Dockerfile'));
    }

    const exist = fs.existsSync(path.join(context, 'Dockerfile'));
    if (!exist) {
      throw new ArchitectError(`${path.join(context, dockerfile)} does not exist. Please verify the correct context and/or dockerfile were given.`);
    }
    return exist;
  }
}
