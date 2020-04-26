import { EnvironmentGraph } from '../../dependency-manager/src/configs/graph';
import { BaseParameterValueConfig } from '../../dependency-manager/src/configs/service-config';
import DockerComposeTemplate, { DockerService } from './template';

export const generate = (graph: EnvironmentGraph) => {
  const compose: DockerComposeTemplate = {
    version: '3',
    services: {},
    volumes: {},
  };

  graph.getServices().forEach(service => {
    let compose_service = {
      depends_on: service.getDependencies().map(dep => dep.getName()),
      environment: {} as { [key: string]: string },
      ports: [],
    } as DockerService;

    if (graph.getDnsConfig()?.searches) {
      compose_service.dns_search = graph.getDnsConfig()?.searches;
    }

    service.getInterfaces().forEach(value => {
      compose_service.ports.push(`${value.port}:${value.port}`);
    });

    service.getParameters().forEach((value, key) => {
      if (value.hasOwnProperty('value_from')) {
        throw new Error('Should not be any value_froms when generating compose files');
      } else {
        value = value as BaseParameterValueConfig;
        compose_service.environment![key] = String(value.default);
      }
    });

    if (service.getPrioritizedCommand(true)) {
      compose_service.command = service.getPrioritizedCommand(true);
    }

    if (service.getPrioritizedEntrypoint(true)) {
      compose_service.entrypoint = service.getPrioritizedEntrypoint(true);
    }

    // Determine whether to build the image from source or not
    const build_config = service.getResolvableBuildConfig();
    if (build_config && build_config.context) {
      compose_service.build = {
        args: [],
        context: build_config.context,
      };

      if (build_config.dockerfile) {
        compose_service.build.dockerfile = build_config.dockerfile;
      }
    } else {
      compose_service.image = service.getImage() || `registry.architect.io/${service.getResolvableRef()}`;
    }

    if (service.getPlatformsConfig()['docker-compose']) {
      compose_service = {
        ...service.getPlatformsConfig()['docker-compose'],
        ...compose_service,
      };
    }

    compose_service.volumes = compose_service.volumes || [];
    service.getResolvableVolumes().forEach(volume => {
      const value = `${volume.host_path}:${volume.mount_path}${volume.readonly ? ':ro' : ''}`;
      compose_service.volumes?.push(value);
    });

    compose.services[service.getResolvableRef()] = compose_service;
  });

  return compose;
};
