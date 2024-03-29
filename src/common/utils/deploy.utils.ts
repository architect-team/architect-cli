import deepmerge from 'deepmerge';
import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import fs from 'fs-extra';
import { ArchitectError, Dictionary, parseSourceYml } from '../../';
import { SecretsDict } from '../../dependency-manager/secrets/type';
import { SecretSpecValue } from '../../dependency-manager/spec/secret-spec';
import { parseEnvironmentVariable } from './secret/helper';
import Cluster from '../../architect/cluster/cluster.entity';
import AppService from '../../app-config/service';
import Deployment from '../../architect/deployment/deployment.entity';

export default class DeployUtils {
  private static getExtraSecrets(secrets: string[] = []): Dictionary<string | number | null> {
    const extra_secrets: { [s: string]: string | number | null } = {};

    for (const [secret_name, secret_value] of Object.entries(process.env || {})) {
      if (secret_name.startsWith('ARC_')) {
        const key = secret_name.substring(4);
        extra_secrets[key] = parseEnvironmentVariable(secret_value);
      }
    }

    for (const secret of secrets) {
      const secret_split = secret.split('=');
      if (secret_split.length !== 2) {
        throw new ArchitectError(`Bad format for secret ${secret}. Please specify in the format --secret SECRET_NAME=SECRET_VALUE`, false);
      }
      extra_secrets[secret_split[0]] = parseEnvironmentVariable(secret_split[1]);
    }

    return extra_secrets;
  }

  private static readSecretsFile(secrets_file_path: string | undefined) {
    let component_secrets: any = {};
    if (secrets_file_path) {
      // Hard error if the secrets file isn't found - otherwise it'll lead to a confusing ux
      const secrets_file_data = fs.readFileSync(secrets_file_path);
      component_secrets = parseSourceYml(secrets_file_data.toString('utf-8'));
    }
    return component_secrets;
  }

  private static readDotEnvSecretsFile(secret_file: string): Dictionary<Dictionary<string | undefined> | undefined> {
    const dot_env_loaded = dotenv.config({ override: true, path: secret_file });
    if (dot_env_loaded.error) {
      throw new Error(`Error loading dotenv file ${secret_file}`);
    }
    const expanded_dot_env = dotenvExpand.expand(dot_env_loaded);
    return { '*': expanded_dot_env.parsed };
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
    let component_secrets: SecretsDict = env_secrets ? env_secrets : {};

    // Check to see if there are multiple secret files; else, just read the single secret file
    for (const secret_file of secrets_file) {
      let secrets_from_file = {};
      if (secret_file.includes('.env')) {
        secrets_from_file = DeployUtils.readDotEnvSecretsFile(secret_file);
      } else {
        secrets_from_file = DeployUtils.readSecretsFile(secret_file);
      }
      // Deep merge to ensure all values from files are captured
      // By default, the last file in the array will always supersede any other values
      component_secrets = deepmerge(component_secrets, secrets_from_file);
    }

    const extra_secrets = DeployUtils.getExtraSecrets(individual_secrets) as Dictionary<SecretSpecValue>;
    if (extra_secrets && Object.keys(extra_secrets).length > 0) {
      if (!component_secrets['*']) {
        component_secrets['*'] = {};
      }
      // Shallow merge to ensure CLI arguments replace anything from the secrets file
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

  static async hasClusterDeployment(app: AppService, cluster: Cluster): Promise<boolean> {
    if (cluster && !cluster.properties.is_shared && !cluster.properties.is_managed) {
      const cluster_deployment: Deployment = (await app.api.get(`clusters/${cluster.id}/apps`)).data;
      return cluster_deployment && cluster_deployment.action !== 'delete';
    }
    return true;
  }
}
