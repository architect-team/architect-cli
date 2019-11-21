import { AxiosInstance } from 'axios';
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import DependencyGraph, { DatastoreNode, DependencyNode, ServiceNode } from '../../dependency-graph/src';
import EnvironmentConfig from '../environment-config';
import MissingRequiredParamError from '../errors/missing-required-param';
import LocalServiceNode from '../local-graph/nodes/local-service';
import PortManager from '../port-manager';
import ServiceConfig from '../service-config';
import ServiceParameterConfig from '../service-config/parameter';

const validateParams = (
  ref_name: string,
  parameters: { [s: string]: ServiceParameterConfig },
  env_params: { [s: string]: string },
): { [key: string]: string } =>
  Object.keys(parameters).reduce((params: { [s: string]: string }, key: string) => {
    const service_param = parameters[key];
    if (service_param.isRequired() && !env_params[key]) {
      throw new MissingRequiredParamError(key, service_param, ref_name);
    }

    let val = env_params[key] || service_param.default || '';
    if (typeof val !== 'string') {
      val = val.toString();
    }

    if (val.startsWith('file:')) {
      val = fs.readFileSync(untildify(val.slice('file:'.length)), 'utf-8');
    }
    params[key] = val;
    if (service_param.alias) {
      params[service_param.alias] = val;
    }
    return params;
  }, {});

const addDatastoreNodes = async (
  parent_node: DependencyNode,
  parent_config: ServiceConfig,
  dependency_graph: DependencyGraph,
  env_config: EnvironmentConfig,
): Promise<DependencyGraph> => {
  for (const [ds_name, ds_config] of Object.entries(parent_config.datastores)) {
    const docker_config = ds_config.getDockerConfig();
    const expose_port = await PortManager.getAvailablePort();
    const dep_node = new DatastoreNode({
      name: `${parent_config.name}.${ds_name}`,
      image: docker_config.image,
      tag: 'local',
      ports: {
        target: docker_config.target_port,
        expose: expose_port,
      },
      parameters: validateParams(
        `${parent_config.name} - [datastore] ${ds_name}`,
        parent_config.datastores[ds_name].parameters || {},
        env_config.getDatastoreParameters(parent_config.name, ds_name),
      ),
    });
    dependency_graph.addNode(dep_node);
    dependency_graph.addEdge(parent_node, dep_node);
  }

  return dependency_graph;
};

const addDependencyNodes = async (
  parent_node: DependencyNode,
  parent_config: ServiceConfig,
  dependency_graph: DependencyGraph,
  env_config: EnvironmentConfig,
  api: AxiosInstance,
): Promise<DependencyGraph> => {
  for (const [dep_name, dep_id] of Object.entries(parent_config.getDependencies())) {
    let dep_node: DependencyNode;
    let dep_config: ServiceConfig;
    const expose_port = await PortManager.getAvailablePort();

    if (dep_id.startsWith('file:')) {
      const dep_path = path.join((parent_node as LocalServiceNode).service_path, dep_id.slice('file:'.length));
      dep_config = ServiceConfig.loadFromPath(dep_path);
      dep_node = new LocalServiceNode({
        service_path: dep_path,
        name: dep_name,
        tag: 'local',
        ports: {
          target: 8080,
          expose: expose_port,
        },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        api: dep_config.api!,
        subscriptions: dep_config.subscriptions,
        parameters: validateParams(
          dep_config.name,
          dep_config.parameters,
          env_config.getServiceParameters(dep_config.name),
        ),
        language: dep_config.language
      });
      if (dep_config.debug) {
        (dep_node as LocalServiceNode).command = dep_config.debug;
      }
    } else {
      const { data: service } = await api.get(`/services/${dep_name}`);
      const { data: dep } = await api.get(`/services/${service.name}/versions/${dep_id}`);
      dep_config = plainToClass(ServiceConfig, dep.config as ServiceConfig);
      dep_node = new ServiceNode({
        name: dep.name,
        tag: dep.tag,
        image: service.url.replace(/(^\w+:|^)\/\//, ''),
        ports: {
          target: 8080,
          expose: expose_port,
        },
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        api: dep_config.api!,
        subscriptions: dep_config.subscriptions,
        parameters: validateParams(
          dep_config.name,
          dep_config.parameters,
          env_config.getServiceParameters(dep_config.name),
        ),
        language: dep_config.language
      });
    }

    dependency_graph.addNode(dep_node);
    dependency_graph.addEdge(parent_node, dep_node);
    await addDependencyNodes(dep_node, dep_config, dependency_graph, env_config, api);
    await addDatastoreNodes(dep_node, dep_config, dependency_graph, env_config);
  }

  return dependency_graph;
};

const generate = async (
  service_paths: string[],
  env_config: EnvironmentConfig,
  api: AxiosInstance,
  recursive = true,
): Promise<DependencyGraph> => {
  const dependencies = new DependencyGraph();

  // Create graph nodes for all specified services and then add nodes
  // and edges for their dependencies
  for (let svc_path of service_paths) {
    svc_path = path.resolve(svc_path);
    const config = ServiceConfig.loadFromPath(svc_path);
    const expose_port = await PortManager.getAvailablePort();
    const dep = new LocalServiceNode({
      service_path: svc_path,
      name: config.name,
      tag: 'local',
      ports: {
        target: 8080,
        expose: expose_port,
      },
      api: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        type: config.api!.type,
        definitions: config.api && config.api.definitions ? config.api.definitions : []
      },
      subscriptions: config.subscriptions || {},
      parameters: validateParams(
        config.name,
        config.parameters,
        env_config.getServiceParameters(config.name)),
      language: config.language
    });
    if (config.debug) {
      dep.command = config.debug;
    }
    dependencies.addNode(dep);

    if (recursive) {
      await addDependencyNodes(dep, config, dependencies, env_config, api);
      await addDatastoreNodes(dep, config, dependencies, env_config);
    }
  }

  // Loop back through the nodes and create edges for event/subscriber relationships
  dependencies.nodes.forEach(node => {
    if (node instanceof ServiceNode) {
      for (const publisher_name of Object.keys(node.subscriptions)) {
        const publisher_ref = Array.from(dependencies.nodes.keys())
          .find(key => key.split(':')[0] === publisher_name);
        if (publisher_ref) {
          const publisher = dependencies.nodes.get(publisher_ref);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          dependencies.addEdge(publisher!, node);
        }
      }
    }
  });

  return dependencies;
};

export default generate;
