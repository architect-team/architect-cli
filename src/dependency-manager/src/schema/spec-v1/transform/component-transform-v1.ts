import { ParameterValue } from '../../../spec/common/parameter-spec';
import { Dictionary, transformDictionary } from '../../../utils/dictionary';
import { ArchitectError } from '../../../utils/errors';
import { ARC_NULL_TOKEN } from '../../../utils/interpolation';
import { ComponentSlug, ComponentSlugUtils, ComponentVersionSlug, ComponentVersionSlugUtils, Slugs } from '../../../utils/slugs';
import { ComponentConfig, ComponentInterfaceConfig, ParameterDefinitionConfig } from '../../config/component-config';
import { ComponentContext, ServiceContext, TaskContext } from '../../config/context';
import { InterfaceConfig, ServiceConfig } from '../../config/service-config';
import { TaskConfig } from '../../config/task-config';
import { ComponentInterfaceSpecV1, ComponentSpecV1, ParameterDefinitionSpecV1 } from '../component-spec-v1';

export const transformComponentSpecV1Name = (name: string): ComponentSlug => {
  const split = ComponentSlugUtils.parse(name);
  return ComponentSlugUtils.build(split.component_account_name, split.component_name);
};

export const transformComponentSpecV1Tag = (tag?: string): string => {
  return tag || Slugs.DEFAULT_TAG;
};

export const transformLocalPathV1 = (component_extends?: string): string | undefined => {
  return component_extends?.startsWith('file:') ? component_extends?.substr('file:'.length) : undefined;
};

export const transformComponentSpecV1Ref = (name: string, tag: string, instance_name: string): ComponentVersionSlug => {
  const split = ComponentSlugUtils.parse(name);
  return ComponentVersionSlugUtils.build(split.component_account_name, split.component_name, tag, instance_name);
};

export const transformBooleanString = (boolean_string: string | boolean): boolean => {
  if (boolean_string === 'true') {
    return true;
  } else if (boolean_string === 'false') {
    return false;
  } else if (typeof boolean_string === 'boolean') {
    return boolean_string;
  } else {
    throw new Error(`Cannot transform ${boolean_string} into a boolean`);
  }
};

export const transformParameterDefinitionSpecV1 = (key: string, parameter_spec: string | number | boolean | ParameterDefinitionSpecV1): ParameterDefinitionConfig => {
  if (parameter_spec && typeof parameter_spec === 'object') {
    return {
      required: parameter_spec.required ? transformBooleanString(parameter_spec.required) : false,
      description: parameter_spec.description,
      default: (!parameter_spec.default && parameter_spec.required === false) ? null : parameter_spec.default,
    };
  } else {
    return {
      default: parameter_spec === null ? undefined : parameter_spec,
    };
  }
};

const transformComponentInterfaceSpecV1 = function (key: string, interface_spec: ComponentInterfaceSpecV1 | string): ComponentInterfaceConfig {
  // TODO: Be more flexible than just url ref
  if (interface_spec instanceof Object && 'host' in interface_spec && 'port' in interface_spec) {
    return interface_spec;
  } else {
    let host, port, protocol, username, password;
    let url = interface_spec instanceof Object ? interface_spec.url : interface_spec;

    const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
    const matches = url_regex.exec(url);
    if (matches) {
      host = `\${{ ${matches[1]}.host }}`;
      port = `\${{ ${matches[1]}.port }}`;
      protocol = `\${{ ${matches[1]}.protocol }}`;
      username = `\${{ ${matches[1]}.username }}`;
      password = `\${{ ${matches[1]}.password }}`;
      url = `\${{ ${matches[1]}.url }}`;

      return {
        host,
        port,
        username,
        password,
        protocol,
        url,
        ...(interface_spec instanceof Object ? interface_spec : {}),
      };
    } else {
      throw new ArchitectError(`Invalid interface url value for 'interfaces.${key}'.\nExpected format: \${{ services.<name>.interfaces.<name>.url }}.`);
    }
  }
};


export const transformComponentContext = (
  dependencies: Dictionary<string>,
  parameters: Dictionary<ParameterDefinitionConfig>,
  interfaces: Dictionary<InterfaceConfig>,
  services: Dictionary<ServiceConfig>,
  tasks: Dictionary<TaskConfig>,
): ComponentContext => {
  const dependency_context: Dictionary<any> = {};
  for (const dk of Object.keys(dependencies)) {
    dependency_context[dk] = { ingresses: {}, interfaces: {} };
  }

  const parameter_context: Dictionary<ParameterValue> = {};
  for (const [pk, pv] of Object.entries(parameters)) {
    if (pv.default === null) {
      parameter_context[pk] = ARC_NULL_TOKEN;
    } else {
      parameter_context[pk] = pv.default === undefined ? '' : pv.default;
    }
  }

  const interface_filler = {
    port: '',
    host: '',
    username: '',
    password: '',
    protocol: '',
    url: '',
  };

  const interface_context: Dictionary<ComponentInterfaceConfig> = {};
  const ingress_context: Dictionary<ComponentInterfaceConfig> = {};
  for (const [ik, iv] of Object.entries(interfaces)) {
    interface_context[ik] = {
      ...interface_filler,
      ...iv,
    };
    ingress_context[ik] = {
      ...interface_filler,
      consumers: [],
      dns_zone: '',
      subdomain: '',
    };
  }

  const service_context: Dictionary<ServiceContext> = {};
  for (const [sk, sv] of Object.entries(services)) {
    const service_interfaces: Dictionary<InterfaceConfig> = {};
    for (const [ik, iv] of Object.entries(interfaces)) {
      service_interfaces[ik] = {
        ...interface_filler,
        ...iv,
      };
    }
    service_context[sk] = {
      interfaces: service_interfaces,
      environment: sv.environment,
    };
  }

  const task_context: Dictionary<TaskContext> = {};
  for (const [tk, tv] of Object.entries(tasks)) {
    task_context[tk] = {
      environment: tv.environment,
    };
  }

  return {
    dependencies: dependency_context,
    parameters: parameter_context,
    ingresses: ingress_context,
    interfaces: interface_context,
    services: service_context,
    tasks: task_context,
  };
};

export const transformComponentSpecV1 = (spec: ComponentSpecV1): ComponentConfig => {

  const tag = transformComponentSpecV1Tag(spec.tag);
  const instance_name = ''; // TODO:269: when do these get set?
  const parameters = transformDictionary(transformParameterDefinitionSpecV1, spec.parameters);
  const services = transformDictionary(transformServiceSpecV1, spec.services);
  const tasks = transformDictionary(transformTaskSpecV1, spec.tasks);
  const interfaces = transformDictionary(transformComponentInterfaceSpecV1, spec.interfaces);
  const dependencies = spec.dependencies || {};

  return {
    name: transformComponentSpecV1Name(spec.name),
    tag,
    ref: transformComponentSpecV1Ref(spec.name, tag, instance_name),

    // TODO:269: when do these get set in the lifecycle?
    // instance_id: string;
    // instance_name: string;
    // instance_date: Date;

    extends: spec.extends,
    local_path: transformLocalPathV1(spec.extends),

    description: spec.description,
    keywords: spec.keywords || [],
    author: spec.author,
    homepage: spec.homepage,

    parameters,

    services,
    tasks,

    dependencies,

    interfaces,

    artifact_image: spec.artifact_image,

    // TODO:269: I'm not sure we want to be setting the context here
    context: transformComponentContext(
      dependencies,
      parameters,
      interfaces,
      services,
      tasks
    ),
  };
};
