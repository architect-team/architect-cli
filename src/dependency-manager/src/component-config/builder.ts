/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { flattenValidationErrorsWithLineNumbers } from '../utils/errors';
import { ComponentConfig } from './base';
import { ComponentConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No environment config file found at ${filepath}`;
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

  static async buildFromPath(input: string): Promise<ComponentConfig> {
    const try_files = ComponentConfigBuilder.getConfigPaths(input);

    // Make sure the file exists
    let file_contents;
    for (const file of try_files) {
      try {
        const data = fs.lstatSync(file);
        if (data.isFile()) {
          file_contents = fs.readFileSync(file, 'utf-8');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!file_contents) {
      throw new MissingConfigFileError(input);
    }

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
      const config = ComponentConfigBuilder.buildFromJSON(js_obj);
      await config.validateOrReject({ groups: ['developer'] });
      // TODO
      // config.setExtends(`file:${input}`);
      return config;
    } catch (err) {
      console.log('Invalid service config:', input);
      throw new Error(JSON.stringify(flattenValidationErrorsWithLineNumbers(err, file_contents), null, 2));
    }
  }

  static transformServiceToComponent(config: any) {
    const parameters = config.parameters || {};
    const dependencies = config.dependencies || {};
    for (const [key, value] of Object.entries(dependencies)) {
      // Flatten any inline dependencies
      if (value instanceof Object) {
        dependencies[key] = (value as any).extends || 'latest';
      } else {
        dependencies[key] = value;
      }
    }
    delete config.parameters;
    delete config.dependencies;
    if (!config.environment) {
      /*
  @Transform(value => {
    if (value instanceof Object) {
      const value_from = value.valueFrom;
      if (value_from.dependency) {
        return `\${ dependencies['${value_from.dependency}'].services.service.parameters.${value_from.value} }`;
      } else if (value_from.interface) {
        return '';
      } else if (value_from.datastore) {
        return `\${ services['datastore-${value_from.datastore}'].parameters.${value_from.value} }`;
      } else {
        return 'TODO: support vault';
      }
    } else {
      return value;
    }
  })
      */
      config.environment = {};
      for (const [parameter_key, parameter_unknown] of Object.entries({ ...parameters })) {
        const parameter = parameter_unknown as any;
        let value;
        // Check for valueFrom
        if (parameter instanceof Object) {
          value = parameter.default || parameter;

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
            prefix = `dependencies.${value.dependency.split(':')[0]}.services.service.`;
          } else if (value.datastore) {
            prefix = `services.datastore-${value.datastore}.`;
          }

          let interpolated = '<error>';
          if (value.value) {
            interpolated = value.value;
            const matches = interpolated.match(/\${?([a-zA-Z0-9_]+)?}?/g) || [];
            for (const match of matches) {
              const lower_match = match.substr(1).toLowerCase();
              let suffix;
              if (lower_match.includes('host') || lower_match.includes('port') || lower_match === 'url') {
                suffix = `interfaces.${value.interface || 'main'}.${lower_match.replace('_', '.')}`;
                if (!prefix) {
                  suffix = `services.service.${suffix}`;
                }
              } else {
                suffix = `parameters.${match.substr(1)}`;
              }
              interpolated = interpolated.replace(match, `\${ ${prefix}${suffix} }`);
            }
          }
          config.environment[parameter_key] = interpolated;

          // This also means it doesn't need to be a top level parameter
          delete parameters[parameter_key];
        } else {
          config.environment[parameter_key] = `\${ parameters.${parameter_key} }`;
        }
      }
    }

    const services: any = {};
    let ext = config.extends;
    delete config.extends;
    // Convert old debug.path to new extends syntax
    if (config.debug?.path) {
      ext = `file:${config.debug?.path}`;
      delete config.debug.path;
    }

    // Support datastores as services
    if (config?.datastores) {
      for (const [datastore_key, datastore_unknown] of Object.entries(config.datastores)) {
        const datastore = datastore_unknown as any;
        const datastore_name = `datastore-${datastore_key}`;
        const datastore_service = {
          name: datastore_name,
          image: datastore.image,
          environment: datastore.parameters,
          interfaces: {
            main: {
              host: datastore.host,
              port: datastore.port,
            },
          },
        };
        services[datastore_name] = datastore_service;
      }
    }
    delete config.datastores;

    // Finally set service to services block
    services['service'] = config;

    return {
      name: config.name,
      parameters: parameters,
      dependencies: dependencies,
      services: services,
      extends: ext,
    };
  }

  static buildFromJSON(obj: any): ComponentConfig {
    // TODO: figure out a better check
    // Transform to component syntax
    if (obj instanceof Object && !obj.services) {
      obj = ComponentConfigBuilder.transformServiceToComponent(obj);
    }
    return plainToClass(ComponentConfigV1, obj);
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
