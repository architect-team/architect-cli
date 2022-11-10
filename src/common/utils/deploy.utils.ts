import { isNumberString } from 'class-validator';
import deepmerge from 'deepmerge';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { ArchitectError, Dictionary } from '../../';
import { SecretsDict, SecretType } from '../../dependency-manager/secrets/type';

export default class DeployUtils {
  private static getExtraSecrets(secrets: string[] = []): Dictionary<string | number | undefined> {
    const extra_secrets: { [s: string]: string | number | undefined } = {};

    for (const [secret_name, secret_value] of Object.entries(process.env || {})) {
      if (secret_name.startsWith('ARC_')) {
        const key = secret_name.substring(4);
        let value: string | number | undefined = secret_value;
        if (value && isNumberString(value)) {
          value = Number.parseFloat(value);
        }
        extra_secrets[key] = value;
      }
    }

    for (const secret of secrets) {
      const secret_split = secret.split('=');
      if (secret_split.length !== 2) {
        throw new ArchitectError(`Bad format for secret ${secret}. Please specify in the format --secret SECRET_NAME=SECRET_VALUE`, false);
      }
      let value: string | number = secret_split[1];
      if (isNumberString(value)) {
        value = Number.parseFloat(value);
      }
      extra_secrets[secret_split[0]] = value;
    }

    return extra_secrets;
  }

  private static readSecretsFile(secrets_file_path: string | undefined) {
    let component_secrets: any = {};
    if (secrets_file_path) {
      // Hard error if the secrets file isn't found - otherwise it'll lead to a confusing ux
      const secrets_file_data = fs.readFileSync(secrets_file_path);
      component_secrets = yaml.load(secrets_file_data.toString('utf-8'));
    }
    return component_secrets;
  }

  static parseFlags(parsedFlags: any): any {
    // Merge any values set via deprecated flags into their supported counterparts
    const flags: any = parsedFlags;
    flags['build-parallel'] = flags.build_parallel ? flags.build_parallel : flags['build-parallel'];
    flags['compose-file'] = flags.compose_file ? flags.compose_file : flags['compose-file'];
    flags['secret-file'] = [...(flags.values || []), ...(flags.secrets || []), ...(flags['secret-file'] || [])];

    // If values were provided and secrets were not provided, override the secrets with the values
    if (!flags['secret-file'] && fs.existsSync('./values.yml')) {
      flags['secret-file'] = ['./values.yml'];
    } else if (!flags['secret-file'] && fs.existsSync('./secrets.yml')) {
      flags['secret-file'] = ['./secrets.yml'];
    }
    return flags;
  }

  static getComponentSecrets(individual_secrets: string[], secrets_file: string[], env_secrets?: SecretsDict): SecretsDict {
    // Check to see if there are multiple secret files; else, just read the single secret file
    let component_secrets: SecretsDict = env_secrets ? env_secrets : {};
    for (const secret_file of secrets_file) {
      const output_catch = DeployUtils.readSecretsFile(secret_file);
      // Deep merge to ensure all values from files are captured
      // By default, the last file in the array will always supersede any other values
      component_secrets = deepmerge(component_secrets, output_catch);
    }

    const extra_secrets = DeployUtils.getExtraSecrets(individual_secrets);
    if (extra_secrets && Object.keys(extra_secrets).length > 0) {
      if (!component_secrets['*']) {
        component_secrets['*'] = {};
      }
      // Shallow merge to ensure CLI arguments replace anything from the secrets file
      component_secrets['*'] = { ...component_secrets['*'], ...extra_secrets } as Dictionary<SecretType>;
    }
    return component_secrets;
  }

  static getInterfacesMap(interfaces: string[]): Dictionary<string> {
    const interfaces_map: Dictionary<string> = {};
    for (const i of interfaces) {
      const [key, value] = i.split(':');
      interfaces_map[key] = value || key;
    }
    return interfaces_map;
  }
}
