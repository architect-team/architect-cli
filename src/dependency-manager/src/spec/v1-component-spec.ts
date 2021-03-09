export default interface ComponentSpecV1 {
  /**
   * Unique name of the component. Must be of the format, <account-name>/<component-name>
   */
  name: string;

  /**
   * A human-readable description of the component and what it should be used for
   */
  description?: string;

  /**
   * An array of keywords that can be used to index the component and make it discoverable for others
   */
  keywords?: string[];

  /**
   * A dictionary of named parameters that this component uses to configure services.
   *
   * Parameters can either be an object describing the parameter or a string shorthand that directly applies to the `default` value.
   */
  parameters?: {
    [key: string]: string | {
      /**
       * The default value to apply to the parameter when one wasn't provided by the operator
       */
      default?: string;

      /**
       * A boolean indicating whether or not an operator is required ot provide a value
       * @default false
       */
      required?: boolean;

      /**
       * A human-readable description of the parameter, how it should be used, and what kinds of values it supports.
       */
      description?: string;
    };
  };

  /**
   * A dictionary of named interfaces that the component makes available to upstreams, including other components via dependencies or environments via interface mapping.
   *
   * Interfaces can either be an object describing the interface, or a string shorthand that directly applies to the `url` value.
   */
  interfaces?: {
    [key: string]: string | {
      /**
       * The url of the downstream interfaces that should be exposed. This will usually be a reference to one of your services interfaces.
       */
      url: string;

      /**
       * A human-readable description of the interface and how it should be used.
       */
      description?: string;
    };
  };

  /**
   * A set of named services that need to be run and persisted in order to power this component.
   */
  services?: {
    [key: string]: DebuggableResourceSpecV1 & {
      /**
       * A set of name interfaces that the service listens for traffic on. Interface definitions consist of either an object or a numerical shorthand that directly applies to the `port` field.
       */
      interfaces?: {
        [key: string]: number | {
          /**
           * The port that the service is listening for requests on
           * @minimum 1
           */
          port: number;

          /**
           * The protocol that the interface responds to
           * @default http
           */
          protocol?: string;

          /**
           * A fixed host address that represents an existing location for the service. Using this field will make this service 'virtual' and will not trigger provisioning.
           */
          host?: string;

          /**
           * A username used to authenticate with the interface via HTTP basic auth
           */
          username?: string;

          /**
           * A password used to authenticate with the interface via HTTP basic auth
           */
          password?: string;
        };
      };
    };
  };

  /**
   * A set of scheduled and triggerable tasks that get registered alongside the component. Tasks are great for data translation, reporting, and much more.
   */
  tasks?: {
    [key: string]: DebuggableResourceSpecV1 & {
      /**
       * A cron string indicating the schedule at which the task will run. Architect will ensure the cron jobs are instrumented correctly regardless of where the task is deployed.
       */
      schedule: string;
    };
  };
}

interface ResourceSpecV1 {
  /**
   * Specify settings for the component that apply only at build-time.
   *
   * When registering a component with build settings, Architect will build the container, publish it to a registry, and replace the build settings with the new image reference before completing registration.
   */
  build?: {
    /**
     * The path to the source context to mount to the container. Must be relative to this configuration file.
     */
    context: string;

    /**
     * A path to a Dockerfile that describes how the image should be built.
     * @default Dockerfile
     */
    dockerfile?: string;
  };

  /**
   * Name and location of a docker image that powers this runtime. This field cannot be used in conjunction with the `build` field.
   */
  image?: string;

  /**
   * A command to be used to start up the service inside the container. If no value is specified, the default CMD from the associated image will be used.
   */
  command?: string | string[];

  /**
   * An entrypoint to be used to start up the service inside the container. If no value is specified, the default ENTRYPOINT from the associated image will be used.
   */
  entrypoint?: string | string[];

  /**
   * The number of vCPUs that should be allocated to each instance of this runtime.
   */
  cpu?: number;

  /**
   * The target amount of memory to allocate for each instance of this runtime. Valid values includes things like 0.5GB, 2GB, 8GB, etc.
   */
  memory?: string;

  /**
   * A key/value dictionary of environment parameters to apply to this runtime.
   */
  environment?: {
    [key: string]: string;
  };

  /**
   * A set of named volumes that the service will request and mount to each service instance.
   *
   * Volumes can either be an object describing the volume or a string shorthand that maps to the `mount_path` value.
   */
  volumes?: {
    [key: string]: string | {
      /**
       * A path inside the container OS that the volume should mount to
       */
      mount_path: string;

      /**
       * The path on the host OS that should be mounted to the container OS. (Note: this is primarily used for application debugging)
       */
      host_path?: string;

      /**
       * A human-readable description of the volume and what kind of data gets stored on it
       */
      description?: string;
    };
  };
}

interface DebuggableResourceSpecV1 extends ResourceSpecV1 {
  /**
   * A set of values for the runtime that will override the others when the service
   * is being run locally. All values that are supported by the top-level service
   * are also supported inside the debug object.
   */
  debug?: ResourceSpecV1;
}
