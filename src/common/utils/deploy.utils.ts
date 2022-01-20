import fs from 'fs-extra';
import yaml from 'js-yaml';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';

export default class DeployUtils {
  private static getExtraEnvironmentVariables(parameters: string[]): Dictionary<string | number | undefined> {
    const extra_env_vars: { [s: string]: string | number | undefined } = {};

    for (const [param_name, param_value] of Object.entries(process.env || {})) {
      if (param_name.startsWith('ARC_')) {
        extra_env_vars[param_name.substring(4)] = param_value;
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const parsed = parseFloat(param_value);
          if (!isNaN(parsed)) {
            extra_env_vars[param_name.substring(4)] = parsed;
          }
          // eslint-disable-next-line no-empty
        } catch { }
      }
    }

    for (const param of parameters) {
      const param_split = param.split('=');
      if (param_split.length !== 2) {
        throw new Error(`Bad format for parameter ${param}. Please specify in the format --parameter PARAM_NAME=PARAM_VALUE`);
      }
      extra_env_vars[param_split[0]] = param_split[1];
    }

    return extra_env_vars;
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
    flags['secrets'] = flags.values ? flags.values : flags['secrets'];

    // If values were provided and secrets were not provided, override the secrets with the values
    if (!flags.secrets && fs.existsSync('./values.yml')) {
      flags.secrets = './values.yml';
    } else if (!flags.secrets && fs.existsSync('./secrets.yml')) {
      flags.secrets = './secrets.yml';
    }
    return flags;
  }

  static getComponentSecrets(secrets: string, parameters: string[]): any {
    const component_secrets = DeployUtils.readSecretsFile(secrets);
    const extra_params = DeployUtils.getExtraEnvironmentVariables(parameters);
    if (extra_params && Object.keys(extra_params).length) {
      if (!component_secrets['*']) {
        component_secrets['*'] = {};
      }
      component_secrets['*'] = { ...component_secrets['*'], ...extra_params };
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
