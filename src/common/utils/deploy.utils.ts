import { isNumberString } from 'class-validator';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { Dictionary } from '../../';

export default class DeployUtils {
  private static getExtraSecrets(secrets: string[] = []): Dictionary<string | number | undefined> {
    const extra_secrets: { [s: string]: string | number | undefined } = {};

    for (const [secret_name, secret_value] of Object.entries(process.env || {})) {
      if (secret_name.startsWith('ARC_')) {
        const key = secret_name.substring(4);
        let value: string | number | undefined = secret_value;
        if (value && isNumberString(value)) {
          value = parseFloat(value);
        }
        extra_secrets[key] = value;
      }
    }

    for (const secret of secrets) {
      const secret_split = secret.split('=');
      if (secret_split.length !== 2) {
        throw new Error(`Bad format for secret ${secret}. Please specify in the format --secret SECRET_NAME=SECRET_VALUE`);
      }
      let value: string | number = secret_split[1];
      if (isNumberString(value)) {
        value = parseFloat(value);
      }
      extra_secrets[secret_split[0]] = value;
    }

    return extra_secrets;
  }

  private static readSecretsFile(secrets_file_path: string | undefined) {
    let component_secrets: any = {};
    if (secrets_file_path && fs.existsSync(secrets_file_path)) {
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
    flags['secrets'] = flags.values ? flags.values : flags.secrets;

    // If values were provided and secrets were not provided, override the secrets with the values
    if (!flags.secrets && fs.existsSync('./values.yml')) {
      flags.secrets = './values.yml';
    } else if (!flags.secrets && fs.existsSync('./secrets.yml')) {
      flags.secrets = './secrets.yml';
    }
    return flags;
  }

  static getComponentSecrets(individual_secrets: string[], secrets_file?: string): Dictionary<Dictionary<string | number | null>> {
    const component_secrets = DeployUtils.readSecretsFile(secrets_file);
    const extra_secrets = DeployUtils.getExtraSecrets(individual_secrets);
    if (extra_secrets && Object.keys(extra_secrets).length) {
      if (!component_secrets['*']) {
        component_secrets['*'] = {};
      }
      component_secrets['*'] = { ...component_secrets['*'], ...extra_secrets };
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
