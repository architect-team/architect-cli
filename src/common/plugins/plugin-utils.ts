import AdmZip from 'adm-zip';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import { createWriteStream } from 'fs-extra';
import { finished } from 'stream';
import * as tar from 'tar';
import { promisify } from 'util';
import { PluginArchitecture, PluginBinary, PluginBundleType, PluginPlatform } from './plugin-manager';

export default class PluginUtils {
  static async downloadFile(url: string, location: string, sha256: string): Promise<void> {
    const writer = createWriteStream(location);
    return axios({
      method: 'get',
      url: url,
      responseType: 'stream',
    }).then(async response => {
      response.data.pipe(writer);
      await promisify(finished)(writer);
      const fileBuffer = fs.readFileSync(location);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const hex = hashSum.digest('hex');
      if (hex !== sha256) {
        throw new Error(`Unable to verify ${url}. Please contact Architect support for help.`)
      }
    });
  }

  static async extractFile(file: string, location: string, bundleType: PluginBundleType): Promise<void> {
    if (bundleType === PluginBundleType.TAR_GZ) {
      await tar.extract({ file, C: location });
    } else if (bundleType === PluginBundleType.ZIP) {
      var zip = new AdmZip(file);
      zip.extractAllTo(location);
    }
  }

  static getBinary(binaries: PluginBinary[], platform: PluginPlatform, architecture: PluginArchitecture): PluginBinary {
    for (const binary of binaries) {
      if (binary.platform === platform && binary.architecture === architecture) {
        return binary;
      }
    }
    throw new Error(`Unable to find proper binary for ${PluginPlatform[platform]}:${PluginArchitecture[architecture]}. Please contact Architect support for help.`);
  }
}

