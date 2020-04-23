import { IsInstance, IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseInterfaceConfig, BaseLivenessProbeConfig, BaseNotificationConfig, BasePlatformsConfig, BaseServiceConfig, BaseServiceMetadataConfig, BaseSubscriptionConfig, BaseVolumeConfig } from '../../base-configs/service-config';
import { Dictionary } from '../../utils/dictionary';
import { validateDictionary, validateNested } from '../../utils/validation';
import { ApiSpecV1 } from './api';
import { InterfacesSpecV1 } from './interfaces';
import { LivenessProbeV1 } from './liveness-probe';
import { NotificationSpecV1 } from './notifications';
import { DockerComposeSpecV1, PlatformsSpecV1 } from './platforms';
import { EventSubscriptionSpecV1 } from './subscriptions';
import { VolumeClaimSpecV1 } from './volume-claim';

export abstract class SharedServiceSpecV1 extends BaseServiceConfig {
  @IsOptional()
  @IsString()
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
  @IsNumber()
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
  api?: ApiSpecV1;

  @IsOptional()
  notifications?: Dictionary<NotificationSpecV1>

  @IsOptional()
  subscriptions?: Dictionary<Dictionary<EventSubscriptionSpecV1>>;

  @IsOptional()
  @IsInstance(PlatformsSpecV1)
  platforms?: PlatformsSpecV1;

  @IsOptional()
  volumes?: Dictionary<VolumeClaimSpecV1>;

  // ------------------------------------------------------
  //  START GETTERS/SETTERS
  // ------------------------------------------------------

  constructor(plain?: any) {
    super(plain);

    if (typeof this.interfaces === 'object') {
      Object.entries(this.interfaces).forEach(([key, value]) => {
        this.interfaces![key] = new InterfacesSpecV1(value);
      });
    }

    if (typeof this.api === 'object') {
      this.api = new ApiSpecV1(this.api);
    }

    if (typeof this.notifications === 'object') {
      Object.entries(this.notifications).forEach(([key, value]) => {
        this.notifications![key] = new NotificationSpecV1(value);
      });
    }

    if (typeof this.subscriptions === 'object') {
      Object.entries(this.subscriptions).forEach(([service_name, event]) => {
        Object.entries(event).forEach(([event_name, value]) => {
          this.subscriptions![service_name][event_name] = new EventSubscriptionSpecV1(value);
        });
      });
    }

    if (typeof this.platforms === 'object') {
      this.platforms = new PlatformsSpecV1(this.platforms);
    }

    if (typeof this.volumes === 'object') {
      Object.entries(this.volumes).forEach(([key, value]) => {
        this.volumes![key] = new VolumeClaimSpecV1(value);
      })
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateDictionary(this, 'interfaces', errors);
    errors = await validateNested(this, 'api', errors);
    errors = await validateDictionary(this, 'notifications', errors);
    errors = await validateNested(this, 'platforms', errors);
    errors = await validateDictionary(this, 'volumes', errors);
    // TODO: subscriptions
    return errors;
  }

  getName() {
    return this.name || '';
  }

  setName(name: string) {
    this.name = name;
  }

  getRef() {
    return this.ref || '';
  }

  setRef(ref: string) {
    this.ref = ref;
  }

  getMetadata(): BaseServiceMetadataConfig {
    return {
      description: this.description,
      tags: this.tags,
      language: this.language,
    };
  }

  setMetadata(metadata: BaseServiceMetadataConfig) {
    this.description = metadata.description;
    this.tags = metadata.tags;
    this.language = metadata.language;
  }

  getInterfaces() {
    const res = new Map<string, BaseInterfaceConfig>(Object.entries(this.interfaces || {}));
    
    if (res.size === 0 && this.port) {
      res.set('default', {
        port: this.port,
        default: true,
      });
    }

    return res;
  }

  setInterfaces(interfaces: Map<string, BaseInterfaceConfig>) {
    const newInterfaces = {} as Dictionary<InterfacesSpecV1>;

    interfaces.forEach((value, key) => {
      const item = new InterfacesSpecV1();
      item.default = value.default;
      item.description = value.description;
      item.port = value.port;
      newInterfaces[key] = item;
    });

    this.interfaces = newInterfaces;
  }

  getVolumes() {
    return new Map(Object.entries(this.volumes || {}));
  }

  setVolumes(volumes: Map<string, BaseVolumeConfig>) {
    const newVolumes = {} as Dictionary<VolumeClaimSpecV1>;

    volumes.forEach((value, key) => {
      const volume = new VolumeClaimSpecV1();
      volume.description = value.description;
      volume.readonly = value.readonly;
      volume.mount_path = value.mount_path;
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

  getDockerfile() {
    // Dockerfile is ignored if an image is set
    if (this.image) {
      return undefined;
    }

    return this.dockerfile;
  }

  setDockerfile(dockerfile?: string) {
    this.dockerfile = dockerfile;
  }

  getLivenessProbe() {
    return this.api?.liveness_probe || {};
  }

  setLivenessProbe(liveness_probe: BaseLivenessProbeConfig) {
    if (!this.api) {
      this.api = new ApiSpecV1();
    }

    const probe = new LivenessProbeV1();
    if (liveness_probe.interval) {
      probe.interval = liveness_probe.interval;
    }

    if (liveness_probe.failure_threshold) {
      probe.failure_threshold = liveness_probe.failure_threshold;
    }

    if (liveness_probe.path) {
      probe.path = liveness_probe.path;
    }

    if (liveness_probe.success_threshold) {
      probe.success_threshold = liveness_probe.success_threshold;
    }

    if (liveness_probe.timeout) {
      probe.timeout = liveness_probe.timeout;
    }

    this.api.liveness_probe = probe;
  }

  getNotifications() {
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
          newSub.headers = {};
          event.headers.forEach((value, key) => {
            newSub.headers![key] = value;
          });
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

  getPlatformsConfig() {
    return this.platforms || {};
  }

  setPlatformsConfig(platforms: BasePlatformsConfig) {
    const newPlatforms = new PlatformsSpecV1();

    if (platforms['docker-compose']) {
      const composeSpec = new DockerComposeSpecV1();

      if (platforms['docker-compose'].privileged) {
        composeSpec.privileged = platforms['docker-compose'].privileged;
      }

      if (platforms['docker-compose'].stop_signal) {
        composeSpec.stop_signal = platforms['docker-compose'].stop_signal;
      }

      newPlatforms['docker-compose'] = composeSpec;
      this.platforms = newPlatforms;
    } else {
      delete this.platforms;
    }
  }
}