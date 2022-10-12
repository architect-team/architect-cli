import axios from 'axios';
import { createWriteStream } from 'fs-extra';
import { finished } from 'stream';
import * as tar from 'tar';
import { promisify } from 'util';

export default class PluginUtils {
  static async downloadFile(url: string, location: string): Promise<void> {
    const writer = createWriteStream(location);
    return axios({
      method: 'get',
      url: url,
      responseType: 'stream',
    }).then(response => {
      response.data.pipe(writer);
      return promisify(finished)(writer);
    });
  }

  static async extractTarGz(file: string, location: string): Promise<void> {
    await tar.extract({ file, C: location });
  }
}

