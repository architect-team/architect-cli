import { instanceToPlain } from 'class-transformer';
import yaml from 'js-yaml';
import { LivenessProbeConfig } from '../../dependency-manager/config/common-config';
import { ServiceInterfaceConfig } from '../../dependency-manager/config/service-config';
import { VolumeSpec } from '../../dependency-manager/spec/common-spec';
import { ComponentSpec } from '../../dependency-manager/spec/component-spec';
import { BuildSpec } from '../../dependency-manager/spec/resource-spec';
import { SecretDefinitionSpec } from '../../dependency-manager/spec/secret-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../../dependency-manager/spec/service-spec';
import { Slugs } from '../../dependency-manager/spec/utils/slugs';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import DockerComposeTemplate, { DockerComposeDeploy, DockerComposeHealthCheck } from './template';

interface ComposeConversion {
  local?: any
  base?: any;
  warnings?: string[];
}

export class ComposeConverter {
  private static compose_property_converters: { compose_property: string, architect_property: string, func: (compose_property: any, docker_compose: DockerComposeTemplate, architect_service: ServiceSpec) => ComposeConversion }[] = [
    { compose_property: 'environment', architect_property: 'environment', func: this.convertEnvironment },
    {
      compose_property: 'command', architect_property: 'command', func: (command: any) => {
        return { base: command };
      },
    },
    {
      compose_property: 'entrypoint', architect_property: 'entrypoint', func: (entrypoint: any) => {
        return { base: entrypoint };
      },
    },
    {
      compose_property: 'image', architect_property: 'image', func: (image: string) => {
        return { base: image };
      },
    },
    { compose_property: 'build', architect_property: 'build', func: this.convertBuild },
    { compose_property: 'ports', architect_property: 'interfaces', func: this.convertPorts },
    { compose_property: 'volumes', architect_property: 'volumes', func: this.convertVolumes },
    { compose_property: 'depends_on', architect_property: 'depends_on', func: this.convertDependsOn },
    { compose_property: 'external_links', architect_property: 'depends_on', func: this.convertDependsOn },
    { compose_property: 'healthcheck', architect_property: 'liveness_probe', func: this.convertHealthcheck },
    { compose_property: 'container_name', architect_property: 'reserved_name', func: this.convertContainerName },
    { compose_property: 'expose', architect_property: 'interfaces', func: this.convertExpose },
    { compose_property: 'deploy', architect_property: 'cpu', func: this.convertCpu },
    { compose_property: 'deploy', architect_property: 'memory', func: this.convertMemory },
    { compose_property: 'labels', architect_property: 'labels', func: this.convertLabels },
    { compose_property: 'secrets', architect_property: 'volumes', func: this.convertSecrets },
  ];

  static convert(docker_compose: DockerComposeTemplate, component_name: string): { architect_yml: string, warnings: string[] } {
    let warnings: string[] = [];

    const architect_component: Partial<ComponentSpec> = {};
    architect_component.name = component_name;
    architect_component.services = {};

    for (const [service_name, service_data] of Object.entries(docker_compose.services || {})) {
      const architect_service = new ServiceSpec();
      for (const [property_name, property_data] of Object.entries(service_data || {})) {
        const converters = this.compose_property_converters.filter(c => c.compose_property === property_name);
        if (converters.length === 0) {
          warnings.push(`Could not convert ${service_name} property "${property_name}"`);
        }
        for (const converter of converters) {
          const architect_property_name = converter.architect_property;
          const converted_props: ComposeConversion = converter.func(property_data, docker_compose, architect_service);
          if (converted_props.local) {
            if (!(architect_service as any).debug) {
              (architect_service as any).debug = {};
            }
            (architect_service as any).debug[architect_property_name] = converted_props.local;
          }

          if (converted_props.base) {
            if (converted_props.base && typeof converted_props.base === 'object' && (architect_service as any)[architect_property_name]) {
              for (const [prop, value] of Object.entries(converted_props.base)) {
                (architect_service as any)[architect_property_name][prop] = value;
              }
            } else {
              (architect_service as any)[architect_property_name] = converted_props.base;
            }
          }

          if (converted_props.warnings) {
            warnings = [...warnings, ...converted_props.warnings];
          }
        }
      }
      if (!architect_service.reserved_name) {
        architect_service.reserved_name = service_name;
      }
      architect_component.services[service_name] = architect_service;
    }

    const { services, secrets } = this.convertServicesInterpolations(architect_component.services);
    architect_component.services = services;
    if (Object.keys(secrets).length > 0) {
      architect_component.secrets = secrets;
    }

    for (const service_config of Object.values(architect_component.services || {})) {
      for (const depends_on of (service_config.depends_on || [])) {
        service_config.environment = service_config.environment || {};
        if (Object.keys(architect_component.services[depends_on].interfaces || {}).length > 0) {
          service_config.environment[`${depends_on.replace('-', '_').toUpperCase()}_URL`] = `\${{ services.${depends_on}.interfaces.main.url }}`;
        }
      }
    }

    const architect_yml = yaml.dump(yaml.load(JSON.stringify(instanceToPlain(architect_component))));
    return { architect_yml, warnings };
  }

  private static parseSecrets(pattern: RegExp, services: Dictionary<ServiceSpec>, use_default: boolean, required: boolean): { service_spec: Dictionary<ServiceSpec>, secrets: Dictionary<SecretDefinitionSpec> } {
    const services_str = JSON.stringify(services);
    const secrets: Dictionary<SecretDefinitionSpec> = {};
    const matches = services_str.match(pattern);
    if (matches) {
      for (const match of matches) {
        let secret;
        if (use_default) {
          secret = { default: match.replace(pattern, '$2') };
        } else if (required) {
          secret = { required: true };
        } else {
          secret = { required: false };
        }
        const secret_key = match.replace(pattern, '$1');
        secrets[secret_key] = secret;
      }
    }
    return {
      service_spec: JSON.parse(services_str.replace(pattern, '${{ secrets.$1 }}')),
      secrets,
    };
  }

  private static convertServicesInterpolations(services: Dictionary<ServiceSpec>): { services: Dictionary<ServiceSpec>, secrets: Dictionary<SecretDefinitionSpec> } {
    const pattern1 = /\${([^:}]+)}/g;  // ${VARIABLE}
    const pattern2 = /\$(\w+)/g;  // $VARIABLE
    const pattern3 = /\${([^:{}]+):-([^\n?{}]*)}/g;  // ${VARIABLE:-default}
    const pattern4 = /\${([^:{}]+):\?([^\n?{}]*)}/g;  // ${VARIABLE:?err}

    let all_secrets: Dictionary<SecretDefinitionSpec> = {};
    for (const pattern of [pattern1, pattern2, pattern3, pattern4]) {
      const use_default = pattern === pattern3;
      const required = pattern === pattern4;
      const { service_spec, secrets } = this.parseSecrets(pattern, services, use_default, required);
      services = service_spec;
      all_secrets = { ...all_secrets, ...secrets };
    }
    return { services, secrets: all_secrets };
  }

  private static convertBuild(compose_build: any): ComposeConversion {
    const warnings: string[] = [];
    const build: BuildSpec = {};
    if (typeof compose_build === 'string') {
      build.context = compose_build;
    } else {
      build.args = {};
      if (Array.isArray(compose_build.args)) {
        for (const arg of compose_build.args) {
          if (!arg) {
            continue;
          }
          const [key, value] = arg.split('=');
          build.args[key] = value ? value.toString() : null;
        }
      } else if (compose_build.args instanceof Object && Object.keys(compose_build.args).length > 0) {
        for (const [key, value] of Object.entries(compose_build.args as Dictionary<any>)) {
          build.args[key] = value ? value.toString() : null;
        }
      }
      build.context = compose_build.context;
      if (compose_build.dockerfile) {
        build.dockerfile = compose_build.dockerfile;
      }
      if (compose_build.target) {
        build.target = compose_build.target;
      }
    }
    return { base: build, warnings };
  }

  private static convertPorts(compose_ports: any[]): ComposeConversion {
    const warnings: string[] = [];
    let port_index = 0;
    const interfaces: Dictionary<any> = {};
    for (const port of compose_ports || []) {
      let interface_name = port_index === 0 ? 'main' : `main${port_index + 1}`;

      if (typeof port === 'string' || typeof port === 'number') {
        const string_port = port.toString();
        const single_number_port_regex = new RegExp('^\\d+$');
        const single_port_regex = new RegExp('(\\d+[:]\\d+)\\/*([a-zA-Z]+)*$');
        const port_range_regex = new RegExp('(\\d+[-]\\d+)\\/*([a-zA-Z]+)*$');

        if (single_number_port_regex.test(string_port)) {
          interfaces[interface_name] = typeof port === 'string' ? Number.parseInt(port) : port;
          port_index++;
        } else if (single_port_regex.test(string_port)) {
          const matches = single_port_regex.exec(string_port);
          const interface_spec: Partial<ServiceInterfaceSpec> = {};
          if (matches && matches.length >= 3) {
            interface_spec.protocol = matches[2];
          }
          if (matches && matches.length >= 2) {
            interface_spec.port = Number.parseInt(matches[1].split(':')[1]);
          }
          (interfaces[interface_name] as Partial<ServiceInterfaceSpec>) = interface_spec;
          port_index++;
        } else if (port_range_regex.test(string_port)) {
          const matches = port_range_regex.exec(string_port);
          if (matches && matches.length >= 2) {
            const [start, end] = matches[1].split('-');
            for (let i = Number.parseInt(start); i < Number.parseInt(end) + 1; i++) {
              interface_name = port_index === 0 ? 'main' : `main${port_index + 1}`;
              interfaces[interface_name] = i;
              port_index++;
            }
          }
        } else {
          warnings.push(`Could not convert port with spec ${port}`);
        }
      } else {
        const interface_spec: Partial<ServiceInterfaceSpec> = {};
        interface_spec.port = typeof port.target === 'string' ? Number.parseInt(port.target) : port.target;
        if (port.protocol) {
          interface_spec.protocol = port.protocol;
        }
        (interfaces[interface_name] as Partial<ServiceInterfaceSpec>) = interface_spec;
        port_index++;
      }
    }
    return { base: interfaces, warnings };
  }

  private static convertVolumes(service_compose_volumes: any[], docker_compose: DockerComposeTemplate): ComposeConversion {
    const warnings: string[] = [];
    const compose_volumes = Object.keys(docker_compose.volumes || {});
    let volume_index = 0;
    const local_volumes: Dictionary<any> = {};
    for (const volume of (service_compose_volumes || [])) {
      const volume_key = volume_index === 0 ? 'volume' : `volume${volume_index + 1}`;
      if (typeof volume === 'string') {
        const volume_parts = volume.split(':');
        if (volume_parts.length === 1) {
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.mount_path = volume_parts[0];
          local_volumes[volume_key] = service_volume;
        } else if (volume_parts.length === 2 || volume_parts.length === 3) {
          const service_volume: Partial<VolumeSpec> = {};
          if (!compose_volumes.includes(volume_parts[0])) {
            service_volume.host_path = volume_parts[0];
          }
          service_volume.mount_path = volume_parts[1];
          if (volume_parts.length === 3 && volume_parts[2] === 'ro') {
            service_volume.readonly = true;
          }
          (local_volumes[volume_key] as Partial<VolumeSpec>) = service_volume;
        } else {
          warnings.push(`Could not convert volume with spec ${volume}`);
        }
      } else if (volume.source) { // local volume
        const service_volume: Partial<VolumeSpec> = {};
        service_volume.host_path = volume.source;
        service_volume.mount_path = volume.target;
        if (volume.read_only) {
          service_volume.readonly = volume.read_only;
        }

        if (volume.type === 'volume' || compose_volumes.includes(volume.source)) {
          service_volume.host_path = undefined;
          local_volumes[volume_key] = service_volume;
        } else {
          local_volumes[volume_key] = service_volume;
        }
      } else {
        const service_volume: Partial<VolumeSpec> = {};
        service_volume.mount_path = volume.target;
        if (volume.read_only) {
          service_volume.readonly = volume.read_only;
        }
        local_volumes[volume_key] = service_volume;
      }
      volume_index++;
    }

    const compose_conversion: ComposeConversion = { warnings };
    if (Object.entries(local_volumes).length > 0) {
      compose_conversion.local = local_volumes;
    }
    return compose_conversion;
  }

  private static convertDependsOn(depends_on_or_links: any, docker_compose: DockerComposeTemplate, architect_service: ServiceSpec): ComposeConversion {
    if (!depends_on_or_links) {
      return {};
    }

    if (!Array.isArray(depends_on_or_links)) {
      depends_on_or_links = Object.keys(depends_on_or_links);
    }

    const depends_on: string[] = [];
    const links: Set<string> = new Set([...(depends_on_or_links || []), ...(architect_service.depends_on || [])]);
    for (const link of links) {
      if (!depends_on.includes(link)) {
        depends_on?.push(link);
      }
    }
    return { base: depends_on.length > 0 ? depends_on : undefined };
  }

  private static convertHealthcheck(compose_healthcheck: DockerComposeHealthCheck): ComposeConversion {
    let liveness_probe_command;
    const command = compose_healthcheck.test;
    if (command && Array.isArray(command)) {
      if (command.length >= 2 && command[0] === 'CMD-SHELL') {
        liveness_probe_command = command.slice(1);
      } else if (command.length > 0 && command[0] === 'CMD') {
        liveness_probe_command = command.slice(1);
      }
    } else if (command && typeof command === 'string') {
      liveness_probe_command = command;
    }

    const liveness_probe: Partial<LivenessProbeConfig> = {
      command: liveness_probe_command,
      interval: compose_healthcheck.interval,
      timeout: compose_healthcheck.timeout,
      failure_threshold: compose_healthcheck.retries,
      initial_delay: compose_healthcheck.start_period,
    };

    return { base: liveness_probe };
  }

  private static convertContainerName(compose_container_name: string): ComposeConversion {
    return { base: compose_container_name };
  }

  private static convertEnvironment(compose_environment: Dictionary<string> | string[]): ComposeConversion {
    if (Array.isArray(compose_environment)) {
      const environment: Dictionary<string> = {};
      const warnings: string[] = [];
      for (const key_value_pair of compose_environment) {
        const key_value: string[] = key_value_pair.split('=');
        if (key_value.length !== 2) {
          warnings.push(`Could not convert environment variable ${key_value_pair}`);
          continue;
        }
        environment[key_value[0]] = key_value[1];
      }
      return { base: environment, warnings };
    }
    return { base: compose_environment };
  }

  private static convertExpose(compose_expose: string[]): ComposeConversion {
    const interfaces: Dictionary<ServiceInterfaceConfig> = {};
    let counter = 0;
    for (const expose_port of compose_expose) {
      interfaces[!counter ? 'expose' : `expose${counter}`] = { port: expose_port };
      counter++;
    }
    return { base: interfaces };
  }

  private static convertCpu(compose_deploy: DockerComposeDeploy): ComposeConversion {
    return { base: compose_deploy.resources?.limits.cpus };
  }

  private static convertMemory(compose_deploy: DockerComposeDeploy): ComposeConversion {
    return { base: compose_deploy.resources?.limits.memory };
  }

  private static convertLabels(compose_labels: Dictionary<string> | string[]): ComposeConversion {
    let labels: Dictionary<string> = {};
    const warnings = [];
    if (Array.isArray(compose_labels)) {
      for (const label of compose_labels) {
        const key_value: string[] = label.split('=');
        if (key_value.length !== 2) {
          warnings.push(`Could not convert label ${label} as it is not 2 parts separated by an "=" sign`);
          continue;
        }
        if (!Slugs.LabelKeySlugValidator.test(key_value[0])) {
          warnings.push(`Label with key ${key_value[0]} could not be converted as it fails validation with regex ${Slugs.LabelKeySlugValidatorString}`);
        } else if (!Slugs.LabelValueSlugValidator.test(key_value[1])) {
          warnings.push(`Label with value ${key_value[1]} could not be converted as it fails validation with regex ${Slugs.LabelValueSlugValidatorString}`);
        } else {
          labels[key_value[0]] = key_value[1];
        }
      }
    } else {
      labels = compose_labels;
    }
    return { base: labels, warnings };
  }

  private static convertSecrets(compose_secrets: Dictionary<string>): ComposeConversion {
    return { warnings: [`Could not convert property "secrets". See https://docs.architect.io/components/secrets/ for information on adding secrets to an Architect component`] };
  }
}
