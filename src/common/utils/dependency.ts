import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import DependencyManager from '../dependency-manager';
import { LocalDependencyNode } from '../dependency-manager/node/local';
import { RemoteDependencyNode } from '../dependency-manager/node/remote';
import EnvironmentConfig from '../environment-config';
import EnvironmentConfigV1 from '../environment-config/v1';
import MissingRequiredParamError from '../errors/missing-required-param';
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
  parent_node: LocalDependencyNode | RemoteDependencyNode,
  parent_config: ServiceConfig,
  dependency_manager: DependencyManager,
  env_config: EnvironmentConfig,
): Promise<DependencyManager> => {
  for (const [ds_name, ds_config] of Object.entries(parent_config.datastores)) {
    const docker_config = ds_config.getDockerConfig();
    const dep_node = await RemoteDependencyNode.create({
      name: `${parent_config.name}.${ds_name}`,
      tag: 'local',
      image: docker_config.image,
      target_port: docker_config.target_port,
      parameters: validateParams(
        `${parent_config.name} - [datastore] ${ds_name}`,
        parent_config.datastores[ds_name].parameters || {},
        env_config.getDatastoreParameters(parent_config.name, ds_name),
      ),
    });
    dep_node.isDatastore = true;
    dependency_manager.addNode(dep_node);
    dependency_manager.addDependency(parent_node, dep_node);
  }

  return dependency_manager;
};

const addDependencyNodes = async (
  parent_node: LocalDependencyNode | RemoteDependencyNode,
  parent_config: ServiceConfig,
  dependency_manager: DependencyManager,
  env_config: EnvironmentConfig,
): Promise<DependencyManager> => {
  if (parent_node instanceof LocalDependencyNode) {
    for (const [dep_name, dep_id] of Object.entries(parent_config.getDependencies())) {
      if (dep_id.startsWith('file:')) {
        const dep_path = path.join(parent_node.service_path, dep_id.slice('file:'.length));
        const dep_config = ServiceConfig.loadFromPath(dep_path);
        const dep_node = await LocalDependencyNode.create({
          service_path: dep_path,
          name: dep_name,
          tag: 'local',
          target_port: 8080,
          api_type: dep_config.api ? dep_config.api.type : undefined,
          api_definitions: dep_config.api ? dep_config.api.definitions : undefined,
          language: dep_config.language,
          subscriptions: dep_config.subscriptions,
          parameters: validateParams(
            dep_config.name,
            dep_config.parameters,
            env_config.getServiceParameters(dep_config.name),
          ),
        });
        if (dep_config.debug) {
          dep_node.command = dep_config.debug;
        }
        dependency_manager.addNode(dep_node);
        dependency_manager.addDependency(parent_node, dep_node);
        await addDependencyNodes(dep_node, dep_config, dependency_manager, env_config);
        await addDatastoreNodes(dep_node, dep_config, dependency_manager, env_config);
      }
    }
  }

  return dependency_manager;
};

export const genFromLocalPaths = async (
  service_paths: string[],
  env_config?: EnvironmentConfig,
  recursive = true,
): Promise<DependencyManager> => {
  const dependencies = new DependencyManager();

  // Create graph nodes for all specified services and then add nodes
  // and edges for their dependencies
  for (let svc_path of service_paths) {
    svc_path = path.resolve(svc_path);
    const config = ServiceConfig.loadFromPath(svc_path);
    const dep = await LocalDependencyNode.create({
      service_path: svc_path,
      name: config.name,
      tag: 'local',
      target_port: 8080,
      api_type: config.api ? config.api.type : undefined,
      api_definitions: config.api ? config.api.definitions : undefined,
      language: config.language,
      subscriptions: config.subscriptions,
      parameters: validateParams(
        config.name,
        config.parameters,
        env_config ? env_config.getServiceParameters(config.name) : {}),
    });
    if (config.debug) {
      dep.command = config.debug;
    }
    dependencies.addNode(dep);

    if (recursive) {
      await addDependencyNodes(dep, config, dependencies, env_config || new EnvironmentConfigV1());
      await addDatastoreNodes(dep, config, dependencies, env_config || new EnvironmentConfigV1());
    }
  }

  // Loop back through the nodes and create edges for event/subscriber relationships
  dependencies.nodes.forEach(node => {
    for (const publisher_name of Object.keys(node.subscriptions)) {
      const publisher_ref = Array.from(dependencies.nodes.keys())
        .find(key => key.split(':')[0] === publisher_name);
      if (publisher_ref) {
        const publisher = dependencies.nodes.get(publisher_ref);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        dependencies.addSubscription(publisher!, node);
      }
    }
  });

  return dependencies;
};
