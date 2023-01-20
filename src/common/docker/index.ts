import fs from 'fs-extra';
import path from 'path';
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

  public static async doesDockerfileExist(context: string): Promise<boolean> {
    try {
      await fs.promises.access(path.join(context, 'Dockerfile'));
      return true;
    } catch (ex) {
      return false;
    }
  }
}
