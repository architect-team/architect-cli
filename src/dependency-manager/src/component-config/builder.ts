/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { Dictionary } from '../utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../utils/errors';
import { replaceBrackets } from '../utils/interpolation';
import { ComponentConfig } from './base';
import { ComponentConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No component config file found at ${filepath}`;
  }
}

export class ComponentConfigBuilder {
  static getConfigPaths(input: string) {
    return [
      input,
      path.join(input, 'architect.json'),
      path.join(input, 'architect.yml'),
      path.join(input, 'architect.yaml'),
    ];
  }

  static readFromPath(input: string): [string, string] {
    const try_files = ComponentConfigBuilder.getConfigPaths(input);

    // Make sure the file exists
    let file_path;
    let file_contents;
    for (const file of try_files) {
      try {
        const data = fs.lstatSync(file);
        if (data.isFile()) {
          file_contents = fs.readFileSync(file, 'utf-8');
          file_path = file;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!file_contents || !file_path) {
      throw new MissingConfigFileError(input);
    }

    return [file_path, file_contents];
  }

  static async buildFromPath(input: string): Promise<ComponentConfig> {
    const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(input);

    let js_obj;
    // Try to parse as json
    try {
      js_obj = JSON.parse(file_contents);
    } catch {
      // Try to parse as yaml
      try {
        js_obj = yaml.safeLoad(file_contents);
      } catch { }
    }

    if (!js_obj) {
      throw new Error('Invalid file format. Must be json or yaml.');
    }

    try {
      // TODO: Figure out how to enforce services block for components during registration
      const config = ComponentConfigBuilder.buildFromJSONCompat(js_obj);
      await config.validateOrReject({ groups: ['developer'] });
      return config;
    } catch (err) {
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(err, file_contents));
    }
  }

  static transformServiceToComponent(config: any) {
    const services: any = {};
    const parameters = config.parameters || {};
    delete config.parameters;

    const inline_dependencies = [];
    const dependencies = config.dependencies || {};
    delete config.dependencies;
    for (const [key, value] of Object.entries(dependencies) as any) {
      if (value instanceof Object) {
        if (value.extends) {
          dependencies[key] = value.extends;
        } else {
          if (value.parameters) {
            value.environment = value.parameters;
            delete value.parameters;
          }
          // Handle inline dependencies
          services[key] = value;
          inline_dependencies.push(key);
          delete dependencies[key];
        }
      } else {
        dependencies[key] = value;
      }
    }

    if (!config.environment) {
      config.environment = ComponentConfigBuilder.transformParametersToEnvironment(parameters, config.datastores);
      if (config.interfaces && Object.keys(config.interfaces).length > 0) {
        const interface_name = Object.keys(config.interfaces)[0];
        if (!config.environment.HOST) {
          config.environment.HOST = `\${ services.service.interfaces.${interface_name}.host }`;
        }
        if (!config.environment.PORT) {
          config.environment.PORT = `\${ services.service.interfaces.${interface_name}.port }`;
        }
      }
    }

    if (config.debug?.parameters) {
      config.debug.environment = ComponentConfigBuilder.transformParametersToEnvironment(parameters);
      delete config.debug.parameters;
    }

    let ext = config.extends;
    delete config.extends;
    // Convert old debug.path to new extends syntax
    if (config.debug?.path) {
      ext = `file:${config.debug?.path}`;
      delete config.debug.path;
    }

    if (!config.image && !config.build) {
      config.build = {
        context: '.',
      };
    }

    // Support datastores as services
    if (config?.datastores) {
      for (const [datastore_key, datastore_unknown] of Object.entries(config.datastores)) {
        const datastore = datastore_unknown as any;
        const datastore_name = `datastore-${datastore_key}`;
        const datastore_environment: Dictionary<string> = {};
        for (const [pk, pv] of Object.entries(datastore.parameters || {}) as any) {
          datastore_environment[pk] = pv instanceof Object && 'default' in pv ? pv.default : pv;
        }
        const datastore_service = {
          name: datastore_name,
          image: datastore.image,
          environment: datastore_environment,
          interfaces: {
            main: {
              host: datastore.host || '',
              port: datastore.port,
            },
          },
        };
        services[datastore_name] = datastore_service;
      }
    }
    delete config.datastores;

    if (!config.interfaces) {
      config.interfaces = {};
    }

    const interfaces: Dictionary<string> = {};
    for (const [ik, iv] of Object.entries(config.interfaces) as any) {
      if (iv instanceof Object && iv.host) {
        continue;
      }
      if (iv instanceof Object ? iv.port : iv) {
        interfaces[ik] = `\${ services.service.interfaces.${ik}.url }`;
      }
    }

    // Finally set service to services block
    services['service'] = config;

    for (const [pk, pv] of Object.entries(parameters)) {
      parameters[pk] = ComponentConfigBuilder.transformInterpolation(pv, inline_dependencies);
    }
    for (const sv of Object.values(services) as any) {
      if (sv.environment) {
        for (const [ek, ev] of Object.entries(sv.environment)) {
          sv.environment[ek] = ComponentConfigBuilder.transformInterpolation(ev, inline_dependencies);
        }
      }
    }

    return {
      name: config.name,
      parameters: parameters,
      dependencies: dependencies,
      services: services,
      interfaces: interfaces,
      extends: ext,
    };
  }

  static transformInterpolation(value: any, inline_dependencies: string[]) {
    if (typeof value === 'string') {
      value = replaceBrackets(value);
      const mustache_regex = new RegExp(`\\\${\\s*(.*?)\\.(.*?)\\.(.*?)\\.(.*?)\\s*}`, 'g');
      let matches;
      let res = value;
      while ((matches = mustache_regex.exec(value)) != null) {
        // eslint-disable-next-line prefer-const
        let [full_match, m0, m1, m2, m3] = matches;

        const orig_value = [m0, m1, m2, m3].join('.');

        // Transform interpolation for inline dep
        if (m0 === 'dependencies' && inline_dependencies.includes(m1)) {
          m0 = 'services';
          if (m2 === 'parameters') m2 = 'environment';
        }

        if (m2 === 'interfaces' && (m3.split('.')[1] === 'internal' || m3.split('.')[1] === 'external')) {
          m3 = m3.replace('internal.', '').replace('external.', '');
        }

        const final_value = [m0, m1, m2, m3].join('.');
        res = res.replace(full_match, full_match.replace(orig_value, final_value));
      }
      return res;
    }
    return value;
  }

  static transformParametersToEnvironment(parameters: any, datastores?: any) {
    const environment: Dictionary<string> = {};
    for (const [parameter_key, parameter_unknown] of Object.entries({ ...parameters })) {
      const parameter = parameter_unknown as any;
      let value;
      // Check for valueFrom
      if (parameter instanceof Object) {
        value = parameter.default !== undefined ? parameter.default : parameter;
        if (value.value_from) {
          value = value.value_from;
        } else if (value.valueFrom) {
          value = value.valueFrom;
        }
      } else {
        value = parameter;
      }
      // If value is a valueFrom convert to interpolation syntax
      if (value instanceof Object) {
        let prefix = '';
        if (value.dependency) {
          prefix = `dependencies.${value.dependency.split(':')[0]}.`;
        } else if (value.datastore) {
          prefix = `services.datastore-${value.datastore}.`;
        }

        let interpolated = `\${ parameters.${parameter_key} }`;
        if (value.value) {
          interpolated = value.value;
          const matches = interpolated.match(/\${?([a-zA-Z0-9_]+)?}?/g) || [];
          for (const match of matches) {
            const lower_match = match.substr(1).toLowerCase();
            let suffix;
            if (lower_match.includes('host') || lower_match.includes('port') || lower_match === 'url') {
              suffix = `interfaces.${value.interface || 'main'}.${lower_match.replace('internal_', '').replace('external_', '')}`;
              interpolated = interpolated.replace(match, `\${ ${prefix}${suffix} }`);
            } else if (value.datastore) {
              const datastore_parameter = datastores[value.datastore].parameters[match.substr(1)];
              interpolated = datastore_parameter.default !== undefined ? datastore_parameter.default : datastore_parameter;
            } else {
              suffix = `parameters.${match.substr(1)}`;
              interpolated = interpolated.replace(match, `\${ ${prefix}${suffix} }`);
            }
          }
          // This also means it doesn't need to be a top level parameter
          delete parameters[parameter_key];
        }
        environment[parameter_key] = interpolated;
      } else {
        if (typeof value === 'string' && value.includes('${') && value.includes('interfaces')) {
          environment[parameter_key] = value;
        } else {
          environment[parameter_key] = `\${ parameters.${parameter_key} }`;
        }
      }
    }
    return environment;
  }

  static buildFromJSON(obj: any): ComponentConfig {
    if (!(obj instanceof Object)) {
      throw new Error('Object required to build from JSON');
    }
    return plainToClass(ComponentConfigV1, obj);
  }

  static buildFromJSONCompat(obj: any): ComponentConfig {
    // Transform to component syntax
    if (obj instanceof Object && !obj.services) {
      obj = ComponentConfigBuilder.transformServiceToComponent(obj);
    }
    return ComponentConfigBuilder.buildFromJSON(obj);
  }

  static saveToPath(config_path: string, config: ComponentConfig) {
    if (config_path.endsWith('.json')) {
      fs.writeJsonSync(config_path, config, { spaces: 2 });
      return;
    } else if (config_path.endsWith('.yml') || config_path.endsWith('.yaml')) {
      fs.writeFileSync(config_path, yaml.safeDump(config));
      return;
    }

    throw new Error(`Cannot save config to invalid path: ${config_path}`);
  }
}
