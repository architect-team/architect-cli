import { ClassTransformOptions } from 'class-transformer';
import { Equals, IsBoolean, IsEmpty, IsInstance, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, ValidateIf, ValidatorOptions } from 'class-validator';
import { BaseSpec } from '../base-spec';
import { BaseBuildConfig, BaseInterfaceConfig, BaseLivenessProbeConfig, BaseNotificationConfig, BaseParameterConfig, BaseParameterValueConfig, BaseParameterValueFromConfig, BasePlatformsConfig, BaseServiceConfig, BaseServiceMetadataConfig, BaseSubscriptionConfig, BaseValueFromDependencyConfig, BaseVolumeConfig } from '../service-config';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary, validateNested } from '../utils/validation';
import { ParameterDefinitionSpecV1, ParameterValueSpecV1, ValueFromDatastoreSpecV1, ValueFromDependencySpecV1, ValueFromWrapperSpecV1 } from './parameters';

class DockerComposePlatformSpecV1 extends BaseSpec {
  @IsOptional()
  @IsBoolean()
  privileged?: boolean;

  @IsOptional()
  @IsString()
  stop_signal?: string;
}

class PlatformsSpecV1 extends BaseSpec {
  @IsOptional()
  @IsInstance(DockerComposePlatformSpecV1)
  'docker-compose'?: DockerComposePlatformSpecV1;

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (this['docker-compose']) {
      this['docker-compose'] = new DockerComposePlatformSpecV1(this['docker-compose'], options);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'docker-compose', errors);
    return errors;
  }
}

class EventSubscriptionSpecV1 extends BaseSpec {
  @IsString()
  uri!: string;

  @IsOptional()
  @IsString({ each: true })
  headers?: Dictionary<string>;
}

class NotificationSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  description?: string;
}

class LivenessProbeV1 extends BaseSpec {
  @IsOptional()
  @IsNumber()
  success_threshold?: number;

  @IsOptional()
  @IsNumber()
  failure_threshold?: number;

  @IsOptional()
  @IsString()
  timeout?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  interval?: string;
}

class InterfacesSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  default?: boolean;

  @IsOptional()
  @IsString()
  @IsUrl()
  host?: string;

  @ValidateIf(obj => !obj.host)
  @IsNotEmpty()
  port?: number;
}

class BuildConfigSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  dockerfile?: string;
}

class ApiSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString({ each: true })
  definitions?: string[];

  @IsOptional()
  @IsInstance(LivenessProbeV1)
  liveness_probe?: LivenessProbeV1;

  constructor(plain?: any) {
    super(plain);

    if (this.liveness_probe) {
      this.liveness_probe = new LivenessProbeV1(this.liveness_probe);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'liveness_probe', errors);
    return errors;
  }
}

class VolumeSpecV1 extends BaseSpec {
  @IsNotEmpty({
    groups: ['developer'],
    message: 'A mount path is required for all volume claims',
  })
  @IsOptional()
  mount_path?: string;

  @IsEmpty({
    groups: ['developer'],
    message: 'Volumes can\'t define hardcoded host mount paths',
  })
  @IsNotEmpty({
    groups: ['developer-debug'],
    message: 'Debug volumes must include a host path to mount to',
  })
  @IsOptional()
  host_path?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  readonly?: boolean;
}

class ServiceDebugSpecV1 extends BaseSpec {
  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Services are portable and cannot be hardcoded to a path on a local machine',
  })
  path?: string;

  @IsOptional()
  command?: string | string[];

  @IsOptional()
  entrypoint?: string | string[];

  @IsOptional()
  @IsString()
  dockerfile?: string;

  @IsOptional()
  volumes?: Dictionary<VolumeSpecV1>;

  @IsOptional()
  build?: BuildConfigSpecV1;

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (typeof this.volumes === 'object') {
      const volumes = {} as Dictionary<VolumeSpecV1>;
      Object.entries(this.volumes).forEach(([key, value]) => {
        volumes[key] = new VolumeSpecV1(value, options);
      });
      this.volumes = volumes;
    }

    if (typeof this.build === 'object') {
      this.build = new BuildConfigSpecV1(this.build, options);
    }
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'volumes', errors, undefined, options);
    errors = await validateNested(this, 'build', errors, options);
    return errors;
  }
}

class DatastoreClaimSpecV1 extends BaseSpec {
  @IsString()
  image!: string;

  @IsNotEmpty()
  port!: number;

  @IsOptional()
  parameters?: Dictionary<ParameterValueSpecV1>;

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (typeof this.parameters === 'object') {
      const params = {} as Dictionary<ParameterValueSpecV1>;
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          params[key] = new ParameterDefinitionSpecV1(value, options);
        } else {
          params[key] = value;
        }
      });
      this.parameters = params;
    }
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'parameters', errors, value => value instanceof ParameterDefinitionSpecV1, options);
    return errors;
  }

  toServiceSpec(service_name: string, datastore_key: string) {
    const newDep = new ServiceSpecV1();
    newDep.name = `${service_name}.${datastore_key}`;
    newDep.image = this.image;
    newDep.port = this.port;
    if (this.parameters) {
      newDep.parameters = this.parameters;
    }

    return newDep;
  }
}

export class ServiceSpecV1 extends BaseServiceConfig {
  @IsOptional()
  @Equals('1')
  __version? = '1';

  @IsOptional()
  @IsString()
  ref?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  interfaces?: Dictionary<InterfacesSpecV1>;

  @IsOptional()
  @IsString()
  @IsUrl()
  host?: string;

  @ValidateIf(obj => !obj.interfaces && !obj.host)
  port?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  dockerfile?: string;

  @IsOptional()
  command?: string | string[];

  @IsOptional()
  entrypoint?: string | string[];

  @IsOptional()
  @IsInstance(ApiSpecV1)
  api?: ApiSpecV1;;

  @IsOptional()
  notifications?: Dictionary<NotificationSpecV1>;

  @IsOptional()
  subscriptions?: Dictionary<Dictionary<EventSubscriptionSpecV1>>;

  @IsOptional()
  @IsInstance(PlatformsSpecV1)
  platforms?: PlatformsSpecV1;

  @IsOptional()
  volumes?: Dictionary<VolumeSpecV1>;

  @IsOptional()
  @IsInstance(ServiceDebugSpecV1)
  debug?: ServiceDebugSpecV1;

  @IsOptional()
  dependencies?: Dictionary<string | ServiceSpecV1> | Array<ServiceSpecV1>;

  @IsOptional()
  datastores?: Dictionary<DatastoreClaimSpecV1>;

  @IsOptional()
  parameters?: Dictionary<ParameterValueSpecV1>;

  // ------------------------------------------------------
  //  START GETTERS/SETTERS
  // ------------------------------------------------------

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (typeof this.interfaces === 'object') {
      const newInterfaces = {} as Dictionary<InterfacesSpecV1>;
      Object.entries(this.interfaces).forEach(([key, value]) => {
        newInterfaces[key] = new InterfacesSpecV1(value, options);
      });
      this.interfaces = newInterfaces;
    }

    if (typeof this.api === 'object') {
      this.api = new ApiSpecV1(this.api);
    }

    if (typeof this.notifications === 'object') {
      const notifications = {} as Dictionary<NotificationSpecV1>;
      Object.entries(this.notifications).forEach(([key, value]) => {
        notifications[key] = new NotificationSpecV1(value, options);
      });
      this.notifications = notifications;
    }

    if (typeof this.subscriptions === 'object') {
      const subscriptions = {} as Dictionary<Dictionary<EventSubscriptionSpecV1>>;
      Object.entries(this.subscriptions).forEach(([service_name, event]) => {
        Object.entries(event).forEach(([event_name, value]) => {
          subscriptions[service_name] = subscriptions[service_name] || {} as Dictionary<EventSubscriptionSpecV1>;
          subscriptions[service_name][event_name] = new EventSubscriptionSpecV1(value, options);
        });
      });
      this.subscriptions = subscriptions;
    }

    if (typeof this.platforms === 'object') {
      this.platforms = new PlatformsSpecV1(this.platforms, options);
    }

    if (typeof this.volumes === 'object') {
      const volumes = {} as Dictionary<VolumeSpecV1>;
      Object.entries(this.volumes).forEach(([key, value]) => {
        volumes[key] = new VolumeSpecV1(value, options);
      });
      this.volumes = volumes;
    }

    if (typeof this.debug === 'object') {
      this.debug = new ServiceDebugSpecV1(this.debug, options);
    }

    if (typeof this.parameters === 'object') {
      const parameters = {} as Dictionary<ParameterValueSpecV1>;
      Object.entries(this.parameters).forEach(([key, value]) => {
        if (typeof value === 'object') {
          parameters[key] = new ParameterDefinitionSpecV1(value, options);
        } else {
          parameters[key] = value;
        }
      });
      this.parameters = parameters;
    }

    if (typeof this.dependencies === 'object') {
      const dependencies = {} as Dictionary<string | ServiceSpecV1>;
      Object.entries(this.dependencies).forEach(([key, value]) => {
        if (typeof value === 'object') {
          dependencies[key] = new ServiceSpecV1(value, options);
        } else {
          dependencies[key] = value;
        }
      });
      this.dependencies = dependencies;
    }

    if (typeof this.datastores === 'object') {
      const datastores = {} as Dictionary<DatastoreClaimSpecV1>;
      Object.entries(this.datastores).forEach(([key, value]) => {
        datastores[key] = new DatastoreClaimSpecV1(value, options);
      });
      this.datastores = datastores;
    }
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'interfaces', errors, undefined, options);
    errors = await validateNested(this, 'api', errors, options);
    errors = await validateDictionary(this, 'notifications', errors, undefined, options);
    errors = await validateNested(this, 'platforms', errors, options);
    errors = await validateDictionary(this, 'volumes', errors, undefined, options);
    errors = await validateDictionary(this, 'datastores', errors, undefined, options);
    errors = await validateDictionary(this, 'dependencies', errors, undefined, options);
    errors = await validateDictionary(this, 'parameters', errors, value => value instanceof ParameterDefinitionSpecV1, options);

    // When assigning debug rules, the developer is also playing the role of an operator
    // not matter what the context. (e.g. volumes require host mounts)
    errors = await validateNested(this, 'debug', errors, {
      ...options,
      groups: [...(options?.groups || []), 'developer-debug'],
    });

    // TODO: subscriptions
    return errors;
  }

  getName() {
    return this.name;
  }

  setName(name?: string) {
    this.name = name;
  }

  getRef() {
    return this.ref;
  }

  setRef(ref?: string) {
    this.ref = ref;
  }

  getMetadata(): BaseServiceMetadataConfig {
    const res = {} as BaseServiceMetadataConfig;

    if (this.description)
      res.description = this.description;

    if (this.tags)
      res.tags = this.tags;

    if (this.language)
      res.language = this.language;

    return res;
  }

  setMetadata(metadata: BaseServiceMetadataConfig) {
    this.description = metadata.description;
    this.tags = metadata.tags;
    this.language = metadata.language;
  }

  getInterfaces() {
    const res = new Map<string, BaseInterfaceConfig>(Object.entries(this.interfaces || {}));

    // If there are no interfaces, populate a default from the host/port
    if (res.size === 0) {
      const default_interface = { default: true } as BaseInterfaceConfig;
      if (this.host)
        default_interface.host = this.host;
      if (this.port)
        default_interface.port = this.port;
      res.set('default', default_interface);
    }

    return res;
  }

  setInterfaces(interfaces: Map<string, BaseInterfaceConfig>) {
    const newInterfaces = {} as Dictionary<InterfacesSpecV1>;

    interfaces.forEach((value, key) => {
      const item = new InterfacesSpecV1();

      if (value.default)
        item.default = value.default;

      if (value.description)
        item.description = value.description;

      if (value.port)
        item.port = value.port;

      if (value.host)
        item.host = value.host;

      newInterfaces[key] = item;
    });

    this.interfaces = newInterfaces;
  }

  getVolumes(): Map<string, BaseVolumeConfig> {
    return new Map(Object.entries(this.volumes || {}));
  }

  setVolumes(volumes: Map<string, BaseVolumeConfig>) {
    const newVolumes = {} as Dictionary<VolumeSpecV1>;

    volumes.forEach((value, key) => {
      const volume = new VolumeSpecV1();
      if (value.description) {
        volume.description = value.description;
      }
      if (value.readonly) {
        volume.readonly = value.readonly;
      }
      if (value.mount_path) {
        volume.mount_path = value.mount_path;
      }
      newVolumes[key] = volume;
    });

    this.volumes = newVolumes;
  }

  getImage() {
    return this.image;
  }

  setImage(image?: string) {
    this.image = image;
  }

  getCommand() {
    return this.command;
  }

  setCommand(command?: string | string[]) {
    this.command = command;
  }

  getEntrypoint() {
    return this.entrypoint;
  }

  setEntrypoint(entrypoint?: string | string[]) {
    this.entrypoint = entrypoint;
  }

  getBuildConfig(): BaseBuildConfig | undefined {
    return this.debug?.build;
  }

  setBuildConfig(config?: BaseBuildConfig) {
    if (config) {
      const newConfig = new BuildConfigSpecV1();

      if (config.context) {
        newConfig.context = config.context;
      }

      if (config.dockerfile) {
        newConfig.dockerfile = config.dockerfile;
      }

      this.debug = this.debug || new ServiceDebugSpecV1();
      this.debug.build = newConfig;
    } else {
      delete this.debug?.build;
    }
  }

  getLivenessProbe() {
    return this.api?.liveness_probe;
  }

  setLivenessProbe(liveness_probe?: BaseLivenessProbeConfig) {
    if (liveness_probe) {
      this.api = this.api || new ApiSpecV1();
      const probe = new LivenessProbeV1();

      if (liveness_probe.interval)
        probe.interval = liveness_probe.interval;

      if (liveness_probe.failure_threshold)
        probe.failure_threshold = liveness_probe.failure_threshold;

      if (liveness_probe.path)
        probe.path = liveness_probe.path;

      if (liveness_probe.success_threshold)
        probe.success_threshold = liveness_probe.success_threshold;

      if (liveness_probe.timeout)
        probe.timeout = liveness_probe.timeout;

      this.api.liveness_probe = probe;
    } else {
      delete this.api?.liveness_probe;
    }
  }

  getNotifications(): Map<string, BaseNotificationConfig> {
    const res = new Map<string, BaseNotificationConfig>();

    Object.entries(this.notifications || {}).forEach(([key, value]) => {
      res.set(key, value);
    });

    return res;
  }

  setNotifications(notifications: Map<string, BaseNotificationConfig>) {
    const newNotifications = {} as Dictionary<NotificationSpecV1>;

    notifications.forEach((value, key) => {
      const notification = new NotificationSpecV1();
      if (value.description) {
        notification.description = value.description;
      }
      newNotifications[key] = notification;
    });

    if (Object.keys(newNotifications).length) {
      this.notifications = newNotifications;
    } else {
      delete this.notifications;
    }
  }

  getSubscriptions(): Map<string, Map<string, BaseSubscriptionConfig>> {
    const res = new Map<string, Map<string, BaseSubscriptionConfig>>();

    Object.entries(this.subscriptions || {}).forEach(([service_name, event]) => {
      const event_map = new Map<string, BaseSubscriptionConfig>();
      Object.entries(event).forEach(([event_name, event_data]) => {
        event_map.set(event_name, {
          uri: event_data.uri,
          headers: new Map(Object.entries(event_data.headers || {})),
        });
      });
      res.set(service_name, event_map);
    });

    return res;
  }

  setSubscriptions(subscriptions: Map<string, Map<string, BaseSubscriptionConfig>>) {
    const newSubscriptions = {} as Dictionary<Dictionary<EventSubscriptionSpecV1>>;

    subscriptions.forEach((event_data, service_name) => {
      newSubscriptions[service_name] = {};
      event_data.forEach((event, event_name) => {
        const newSub = new EventSubscriptionSpecV1();
        newSub.uri = event.uri;

        if (event.headers.size) {
          const headers = {} as { [key: string]: string };
          event.headers.forEach((value, key) => {
            headers[key] = value;
          });
          newSub.headers = headers;
        }

        newSubscriptions[service_name][event_name] = newSub;
      });
    });

    if (Object.keys(newSubscriptions).length) {
      this.subscriptions = newSubscriptions;
    } else {
      delete this.subscriptions;
    }
  }

  getPlatformsConfig(): BasePlatformsConfig {
    return this.platforms || {};
  }

  setPlatformsConfig(platforms: BasePlatformsConfig) {
    const newPlatforms = new PlatformsSpecV1();

    if (platforms['docker-compose']) {
      const composeSpec = new DockerComposePlatformSpecV1();

      if (platforms['docker-compose'].privileged)
        composeSpec.privileged = platforms['docker-compose'].privileged;

      if (platforms['docker-compose'].stop_signal)
        composeSpec.stop_signal = platforms['docker-compose'].stop_signal;

      newPlatforms['docker-compose'] = composeSpec;
      this.platforms = newPlatforms;
    } else {
      delete this.platforms;
    }
  }

  getDebugCommand() {
    if (typeof this.debug === 'string') {
      return this.debug;
    } else {
      return this.debug?.command;
    }
  }

  setDebugCommand(command?: string | string[]) {
    if (command) {
      if (!(this.debug instanceof ServiceDebugSpecV1)) {
        const newDebug = new ServiceDebugSpecV1();
        newDebug.command = this.debug;
        this.debug = newDebug;
      }

      this.debug = this.debug || new ServiceDebugSpecV1();
      this.debug.command = command;
    } else if (typeof this.debug === 'string') {
      delete this.debug;
    } else {
      delete this.debug?.command;
    }
  }

  getDebugEntrypoint() {
    if (this.debug instanceof ServiceDebugSpecV1) {
      return this.debug?.entrypoint;
    }

    return undefined;
  }

  setDebugEntrypoint(entrypoint?: string | string[]) {
    if (entrypoint) {
      if (!(this.debug instanceof ServiceDebugSpecV1)) {
        const newDebug = new ServiceDebugSpecV1();
        newDebug.command = this.debug;
        this.debug = newDebug;
      }

      this.debug = this.debug || new ServiceDebugSpecV1();
      this.debug.entrypoint = entrypoint;
    } else if (this.debug instanceof ServiceDebugSpecV1) {
      delete this.debug?.entrypoint;
    }
  }

  getDebugVolumes(): Map<string, BaseVolumeConfig> {
    if (this.debug instanceof ServiceDebugSpecV1) {
      return new Map(Object.entries(this.debug?.volumes || {}));
    }

    return new Map();
  }

  setDebugVolumes(volumes: Map<string, BaseVolumeConfig>) {
    const newVolumes = {} as Dictionary<VolumeSpecV1>;

    volumes.forEach((value, key) => {
      const volume = new VolumeSpecV1();
      if (value.description) {
        volume.description = value.description;
      }
      if (value.readonly) {
        volume.readonly = value.readonly;
      }
      if (value.mount_path) {
        volume.mount_path = value.mount_path;
      }
      if (value.host_path) {
        volume.host_path = value.host_path;
      }
      newVolumes[key] = volume;
    });

    if (!(this.debug instanceof ServiceDebugSpecV1)) {
      const newDebug = new ServiceDebugSpecV1();
      newDebug.command = this.debug;
      this.debug = newDebug;
    }

    this.debug = this.debug || new ServiceDebugSpecV1();
    this.debug.volumes = newVolumes;
  }

  getDebugPath() {
    if (this.debug instanceof ServiceDebugSpecV1) {
      return this.debug?.path;
    }

    return undefined;
  }

  setDebugPath(debug_path?: string) {
    if (debug_path) {
      if (!(this.debug instanceof ServiceDebugSpecV1)) {
        const newDebug = new ServiceDebugSpecV1();
        newDebug.command = this.debug;
        this.debug = newDebug;
      }

      this.debug = this.debug || new ServiceDebugSpecV1();
      this.debug.path = debug_path;
    } else if (this.debug instanceof ServiceDebugSpecV1) {
      delete this.debug?.path;
    }
  }

  getParameters() {
    const res = new Map<string, BaseParameterConfig>();

    Object.entries(this.parameters || {}).forEach(([key, value]) => {
      // If it's a raw value, set it as default before returning
      if (!(value instanceof ParameterDefinitionSpecV1)) {
        res.set(key, { default: value });
      } else {
        let value_from = value.value_from || value.valueFrom;
        if (value.default instanceof ValueFromWrapperSpecV1) {
          value_from = value_from || value.default.value_from || value.default.valueFrom;
        }

        // Transform a datastore to a dependency reference
        if (value_from && value_from instanceof ValueFromDatastoreSpecV1) {
          res.set(key, {
            value_from: {
              dependency: `${this.name}.${value_from.datastore}`,
              value: value_from.value,
            },
          });
        } else if (value_from) {
          res.set(key, { value_from });
        } else {
          const item = {} as BaseParameterValueConfig;
          if (value.description) {
            item.description = value.description;
          }

          if (value.required) {
            item.required = value.required;
          }

          if (typeof value.default === 'string' || typeof value.default === 'number') {
            item.default = value.default;
          }

          res.set(key, item);
        }
      }
    });

    return res;
  }

  setParameters(parameters: Map<string, BaseParameterConfig>) {
    const newParameters = {} as Dictionary<ParameterValueSpecV1>;

    parameters.forEach((value, key) => {
      const param = new ParameterDefinitionSpecV1();
      if (value.hasOwnProperty('default')) {
        value = value as BaseParameterValueConfig;
        param.default = value.default;
        param.required = value.required;
        param.description = value.description;
      } else {
        value = value as BaseParameterValueFromConfig;
        if (value.value_from.hasOwnProperty('vault')) {
          throw new Error('Services cannot hardcode values from vaults');
        }
        param.value_from = new ValueFromDependencySpecV1();
        const value_from = value.value_from as BaseValueFromDependencyConfig;
        param.value_from.dependency = value_from.dependency;
        param.value_from.value = value_from.value;
      }

      newParameters[key] = param;
    });

    this.parameters = newParameters;
  }

  getDependencies(): Array<BaseServiceConfig> {
    let res = new Array<BaseServiceConfig>();

    if (Array.isArray(this.dependencies)) {
      res = this.dependencies;
    } else if (this.dependencies) {
      Object.entries(this.dependencies).forEach(([dep_name, value]) => {
        if (typeof value === 'string') {
          const newDep = new ServiceSpecV1();
          newDep.name = dep_name;
          newDep.ref = value;
          res.push(newDep);
        } else {
          value.setName(dep_name);
          res.push(value);
        }
      });
    }

    if (this.datastores) {
      Object.entries(this.datastores).forEach(([key, value]) => {
        res.push(value.toServiceSpec(this.name || '', key));
      });
    }

    return res;
  }

  setDependencies(dependencies: Array<BaseServiceConfig>) {
    const newDeps = {} as Dictionary<string | ServiceSpecV1>;
    dependencies.forEach(value => {
      const name = value.getName();
      if (!name) {
        throw new Error('Dependencies must have a name');
      }

      newDeps[name] = ServiceSpecV1.copy(value);
    });
    this.dependencies = newDeps;
  }
}
