import { classToPlain } from 'class-transformer';
import yaml from 'js-yaml';
import { LivenessProbeConfig } from '../../dependency-manager/config/common-config';
import { VolumeSpec } from '../../dependency-manager/spec/common-spec';
import { ComponentSpec } from '../../dependency-manager/spec/component-spec';
import { BuildSpec } from '../../dependency-manager/spec/resource-spec';
import { ServiceInterfaceSpec, ServiceSpec } from '../../dependency-manager/spec/service-spec';
import { Dictionary } from '../../dependency-manager/utils/dictionary';
import DockerComposeTemplate, { DockerComposeHealthCheck } from './template';

interface ComposeConversion {
  local?: any
  base?: any;
  warnings?: string[];
}

export class ComposeConverter {

  private static compose_property_converters: { compose_property: string, architect_property: string, func: (compose_property: any, docker_compose: DockerComposeTemplate, architect_service: Partial<ServiceSpec>) => ComposeConversion }[] = [
    { compose_property: 'environment',  architect_property: 'environment', func: this.convertEnvironment },
    { compose_property: 'command', architect_property: 'command', func: (command: any) => { return { base: command }; } },
    { compose_property: 'entrypoint', architect_property: 'entrypoint', func: (entrypoint: any) => { return { base: entrypoint }; } },
    { compose_property: 'image', architect_property: 'image', func: (image: string) => { return { base: image }; } },
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
  ];

  static convert(docker_compose: DockerComposeTemplate, component_name: string): { architect_yml: string, warnings: string[] } {
    let warnings: string[] = [];

    const architect_component: Partial<ComponentSpec> = {};
    architect_component.name = component_name;
    architect_component.services = {};

    for (const [service_name, service_data] of Object.entries(docker_compose.services || {})) {
      const architect_service: Partial<ServiceSpec> = {};
      for (const [property_name, property_data] of Object.entries(service_data || {})) {

        const converters = this.compose_property_converters.filter(c => c.compose_property === property_name);
        if (!converters.length) {
          warnings.push(`Could not convert ${service_name} property ${property_name}`);
        }
        for (const converter of converters) {
          const architect_property_name = converter.architect_property;
          const converted_props: ComposeConversion = converter.func(property_data, docker_compose, architect_service);
          if (converted_props.local) {
            const local_block_key = "${{ if architect.environment == 'local' }}";
            if (!(architect_service as any)[local_block_key]) {
              (architect_service as any)[local_block_key] = {};
            }
            (architect_service as any)[local_block_key][architect_property_name] = converted_props.local;
          }

          if (converted_props.base) {
            if (converted_props.base && typeof converted_props.base === 'object' && (architect_service as any)[architect_property_name]) { // TODO: same check for local, convert to func
              for (const [prop, value] of Object.entries(converted_props.base)) {
                (architect_service as any)[architect_property_name][prop] = value;
              }
            } else {
              (architect_service as any)[architect_property_name] = converted_props.base;
            }
          }

          if (converted_props.warnings) {
            warnings = warnings.concat(converted_props.warnings);
          }
        }
      }
      if (!architect_service.reserved_name) {
        architect_service.reserved_name = service_name;
      }
      architect_component.services[service_name] = architect_service;
    }

    for (const service_config of Object.values(architect_component.services || {})) {
      for (const depends_on of (service_config.depends_on || [])) {
        service_config.environment = service_config.environment || {};
        if (Object.keys(architect_component.services[depends_on].interfaces || {}).length) {
          service_config.environment[`${depends_on.replace('-', '_').toUpperCase()}_URL`] = `\${{ services.${depends_on}.interfaces.main.url }}`;
        }
      }
    }

    const architect_yml = yaml.dump(yaml.load(JSON.stringify(classToPlain(architect_component))));
    return { architect_yml, warnings };
  }

  private static convertBuild(compose_build: any): ComposeConversion {
    const warnings: string[] = [];
    const build: BuildSpec = {};
    if (typeof compose_build === 'string') {
      build.context = compose_build;
    } else {
      if (Array.isArray(compose_build.args)) {
        build.args = {};
        for (const arg of compose_build.args) {
          const [key, value] = arg.split('=');
          if (key && value) {
            build.args[key] = value;
          } else {
            warnings.push(`Could not convert environment variable ${arg}`);
          }
        }
      } else {
        build.args = compose_build.args;
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
          interfaces[interface_name] = typeof port === 'string' ? parseInt(port) : port;
          port_index++;
        } else if (single_port_regex.test(string_port)) {
          const matches = single_port_regex.exec(string_port);
          const interface_spec: Partial<ServiceInterfaceSpec> = {};
          if (matches && matches.length >= 3) {
            interface_spec.protocol = matches[2];
          }
          if (matches && matches.length >= 2) {
            interface_spec.port = parseInt(matches[1].split(':')[1]);
          }
          (interfaces[interface_name] as Partial<ServiceInterfaceSpec>) = interface_spec;
          port_index++;
        } else if (port_range_regex.test(string_port)) {
          const matches = port_range_regex.exec(string_port);
          if (matches && matches.length >= 2) {
            const [start, end] = matches[1].split('-');
            for (let i = parseInt(start); i < parseInt(end) + 1; i++) {
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
        interface_spec.port = typeof port.target === 'string' ? parseInt(port.target) : port.target;
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
    const volumes: Dictionary<any> = {};
    for (const volume of (service_compose_volumes || [])) {
      const volume_key = volume_index === 0 ? 'volume' : `volume${volume_index + 1}`;
      if (typeof volume === 'string') {
        const volume_parts = volume.split(':');
        if (volume_parts.length === 1) {
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.mount_path = volume_parts[0];
          volumes[volume_key] = service_volume;
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
      } else {
        if (volume.source) { // local volume
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.host_path = volume.source;
          service_volume.mount_path = volume.target;
          if (volume.read_only) {
            service_volume.readonly = volume.read_only;
          }

          if (volume.type === 'volume' || compose_volumes.includes(volume.source)) {
            service_volume.host_path = undefined;
            volumes[volume_key] = service_volume;
          } else {
            local_volumes[volume_key] = service_volume;
          }
        } else {
          const service_volume: Partial<VolumeSpec> = {};
          service_volume.mount_path = volume.target;
          if (volume.read_only) {
            service_volume.readonly = volume.read_only;
          }
          volumes[volume_key] = service_volume;
        }
      }
      volume_index++;
    }

    const compose_conversion: ComposeConversion = { warnings };
    if (Object.entries(local_volumes).length) {
      compose_conversion.local = local_volumes;
    }
    if (Object.entries(volumes).length) {
      compose_conversion.base = volumes;
    }
    return compose_conversion;
  }

  private static convertDependsOn(depends_on_or_links: any, docker_compose: DockerComposeTemplate, architect_service: Partial<ServiceSpec>): ComposeConversion {
    if (!depends_on_or_links.length) {
      return {};
    }

    const depends_on: string[] = [];
    const links: Set<string> = new Set((depends_on_or_links || []).concat(architect_service.depends_on || []));
    for (const link of links) {
      if (!depends_on.includes(link)) {
        depends_on?.push(link);
      }
    }
    return { base: depends_on.length ? depends_on : undefined };
  }

  private static convertHealthcheck(compose_healthcheck: DockerComposeHealthCheck): ComposeConversion {
    let liveness_probe_command;
    const command = compose_healthcheck.test;
    if (command && Array.isArray(command)) { // TODO: check/test other versions https://docs.docker.com/compose/compose-file/compose-file-v3/#healthcheck
      if (command.length >= 2 && command[0] === 'CMD-SHELL') {
        liveness_probe_command = command.slice(1);
      } else if (command.length && command[0] === 'CMD') { // TODO: test for this version
        liveness_probe_command = command.slice(1);
      }
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

  private static convertEnvironment(compose_environment: any): ComposeConversion { // TODO: convert compose service refs in env variables => service urls?
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
    const interfaces: Dictionary<any> = {}; // TODO: type?
    let counter = 0;
    for (const expose_port of compose_expose) {
      interfaces[!counter ? 'expose' : `expose${counter}`] = { port: expose_port };
      counter++;
    }
    return { base: interfaces };
  }

  private static convertCpu(compose_deploy: any): ComposeConversion {
    return { base: compose_deploy.resources.limits.cpu };
  }

  private static convertMemory(compose_deploy: any): ComposeConversion {
    return { base: compose_deploy.resources.limits.memory };
  }

  private static convertLabels(compose_labels: any): ComposeConversion {
    let labels: Dictionary<string> = {};
    const warnings = [];
    if (Array.isArray(compose_labels)) {
      for (const label of compose_labels) {
        const key_value: string[] = label.split('=');
        if (key_value.length !== 2) {
          warnings.push(`Could not convert label ${label}`);
          continue;
        }
        labels[key_value[0]] = key_value[1];
      }
    } else {
      labels = compose_labels;
    }

    return { base: labels, warnings };
  } // TODO: loosen label restrictions? based on need in https://github.com/docker/awesome-compose/blob/master/traefik-golang/compose.yaml

  // TODO: support compose secrets? ex. https://github.com/docker/awesome-compose/blob/master/nginx-flask-mysql/compose.yaml
}
