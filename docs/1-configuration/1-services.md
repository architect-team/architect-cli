---
title: Services
---

# Services

Services describe the runtimes that power your application. Each service described in an `architect.yml` file will automatically be deployed to its own horizontally scaling replica with load balancing seamlessly between instances.

```yaml
services:
  my-api:
    build:
      context: ./path/to/docker/build/context
      dockerfile: ./relative/to/context/Dockerfile
    command: npm start
    entrypoint: entrypoint override for dockerfile ENTRYPOINT
    interfaces:
      public:
        port: 8080
        protocol: http
      admin: 8081
    liveness_probe:
      port: 8080
      path: /health
    environment:
      DB_ADDR: rds.amazonwebservices.com/db-name
      DB_USER: postgres
      DB_PASS: password
    debug:
      command: npm run dev
      volumes:
        src:
          host_path: ./src/
          mount_path: /usr/app/src/
```

## Configuration options

### build

(optional) An object containing the details necessary for Architect to build the service via Docker. Whenever a service that specifies a `build` field is registered with Architect, the CLI will trigger a `docker build` and replace the `build` field with a resolvable [image](#image).

```yaml
build:
  # The path to the directory containing the source code relative to the architect.yml file
  context: ./

  # The path to the Dockerfile relative to the build.context (default: Dockerfile)
  dockerfile: Dockerfile
```

_This field cannot be used in conjunction with the `image` field_

### image

(optional) A string referencing the address of an existing docker image that powers this service.

_This field cannot be used in conjunction with the `build` field_

### command

(optional) A string or string[] specifying the command to be used to start up the service inside the container. If no value is specified, the default `CMD` from the associated image will be used.

### entrypoint

(optional) A string or string[] specifying the entrypoint to be used to start up the service inside the container. If no value is specified, the default `ENTRYPOINT` from the associated image will be used.

### interfaces

A dictionary containing a set of named interfaces that the service listens for requests on. Each interface must at minimum specify the port it is listening for requests on.

```yaml
interfaces:
  public:
    # (required) Port that the service is listening for traffic on
    port: 8080

    # (optional) Protocol that the interface responds to (default: http)
    protocol: http

    # (optional) The host address of an existing service to use instead of provisioning a new one
    host: rds.amazonwebservices.com

    # (optional) A basic auth username required to access the interface
    username: ${{ parameters.API_USERNAME }}

    # (optional) A basic auth password required to access the interface
    password: ${{ parameters.API_PASSWORD }}

    # (optional, defaults to false) Requests made to this interface, if made external, will use sticky sessions
    sticky: true
```

Since many services use http for traffic, interfaces also support a simple short-hand for specifying the service port:

```yaml
interfaces:
  public: 8080
```

#### Overriding service hosts

Architect supports overriding a service with the URL of an external host. When this is done, the service will not be created by Architect, but all of the interpolated values of the service will continue to be produced. This is a common pattern in cases where a user wants Architect to manage everything for local development, but wants to reference a managed service such as a database instance for staging or production. For example, the service below represents a Postgres database service that can be either managed by Architect or effectively an external reference:

```yml
...
parameters:
  postgres_host:
    required: false
...
services:
  api-db:
    image: postgres:11
    interfaces:
      postgres:
        host: ${{ parameters.postgres_host }}
        port: 5432
        protocol: postgresql
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: architect
      POSTGRES_DB: architect_postgres_db
...
```

The parameter `postgres_host` will determine whether or not the service will be provisioned by Architect. If `postgres_host` is not set, Architect will provision the `api-db` service and create a `postgres:11` container. If the `postgres_host` parameter is set, `image: postgres:11` will be ignored and the container will not be provisioned by Architect. Any interpolated values that include the `api-db` service will produce the correct output in either instance with the difference being that `${{ services.api-db.interfaces.postgres.host }}` and `${{ services.api-db.interfaces.postgres.url }}` will change based on the `host` of the interface. Note that if a service has multiple interfaces and you would like to reference an external service, all of the Architect service's interfaces must specify the `host` override.

### liveness_probe
This configuration is essentially the health check for the service. It's important to specify so that traffic isn't load balanced to unhealthy services. Critical for rolling updates to function properly.
```yaml
liveness_probe:
  # (required) Port that the http check will run against
  port: 8080
  # (required) Path for the http check
  path: /health
  # (optional, defaults to 0s) Delays the check from running for the specified amount of time
  initial_delay: 0s
  # (optional, defaults to 30s) The time period in seconds between each health check execution. You may specify between 5 and 300 seconds.
  interval: 30s
  # (optional, defaults to 5s) The time period in seconds to wait for a health check to succeed before it is considered a failure. You may specify between 2 and 60 seconds.
  timeout: 5s
  # (optional, defaults to 1) The number of times to retry a health check before the container is considered healthy.
  success_threshold: 1
  # (optional, defaults to 1) The number of times to retry a failed health check before the container is considered unhealthy. You may specify between 1 and 10 retries.
  failure_threshold: 1
```

### environment

A key-value store of environment variables to be injected into the service runtime.

```yaml
environment:
  NODE_ENV: dev
  STRIPE_API_KEY: abc-123
```

### volumes

(optional) A dictionary containing a set of named volumes that the service will request and mount to each service instance. Architect can take advantage of volumes to store data that should be shared between running containers or that should persist beyond the lifetime of a container.

#### Local configuration

If you would like to use the local filesystem as a volume or a `docker-compose` volume, use the options below in the **debug** block of your service:


```yaml
volumes:
  my-volume-name:
    # Directory at which the volume will be mounted inside the container
    mount_path: /usr/app/images

    # (optional) Human-readable description of volume
    description: Description of my volume

    # (optional) A directory on the host machine to sync with the mount_path on the docker image.
    # This is primarily used for local debugging
    host_path: ./relative/to/architect.yml

    # (optional) The name of a `docker-compose` volume that has already been created on the host machine.
    # This is primarily used for local debugging
    key: my-compose-volume
```

#### Kubernetes

Kubernetes persistent volume claims should be created in advance of a deployment requiring volumes. A persistent volume will in turn be created by the persistent volume claim as long as the cluster has a default storage class set as the default. Be sure to create the claim(s) in the same namespace that the services will be created in. Also a label with key `architect.io/component` and value `<component-account-name>-<component-name>` must be added to any node in the cluster in the event that the volume is shared between component services. An example of a persistent volume configuration that can be applied to a cluster namespace is below:

```yml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: my-claim
spec:
  accessModes:
    - ReadWriteOnce
    - ReadWriteMany # The PVC may not be created if the Kubernetes provider doesn't support this. If the PVC is stuck in a "Pending" state, try to create the claim without this accessMode
    - ReadOnlyMany # see note above
  resources:
    requests:
      storage: 5Gi
```

In order to use the persistent volume above in a service, include a block of the type below:

```yml
...
  volumes:
    my-volume:
      # Directory at which the volume will be mounted inside the container
      mount_path: /usr/app/images

      # Name of the persistent volume claim that has been created in the Kubernetes cluster
      key: my-claim-name
...
```

#### ECS

Deployments to AWS ECS can leverage EFS volumes for data storage. To use an EFS volume in a component configure the volume in the service config like so:

```yml
...
  volumes:
    my-volume:
      # Directory at which the volume will be mounted inside the container
      mount_path: /usr/app/images

      # ID of the EFS volume that has been created in AWS
      key: my-efs-id
...
```

The config above assumes that a volume has been created in EFS with the ID `my-efs-id`. The volume should be mounted with an AWS volume mount into the same VPC as the platform apps that were installed, which is a VPC named `arc-managed-apps--<architect account name>-<architect platform name>`. The security group of the volume mount should have an inbound rule allowing NFS type traffic to port 2049 from a source which is the CIDR block of the previously-mentioned VPC.

### debug

(optional) A set of values for the service that will override the others when the service is being run locally. All values that are supported by the top-level service are also supported inside the `debug` object.

```yaml
debug:
  # An entrypoint for the container that will take effect locally
  entrypoint: npm

  # A command to be run only when the service is running locally
  command: run dev

  # An alternative build process to use for local dev
  build:
    dockerfile: Dockerfile.dev

  # A set of volumes to mount only when running locally
  volumes:
    src:
      description: Mount the src dir for hot-reloading
      host_path: ./src/
      mount_path: /usr/app/src/
```

### cpu & memory

`cpu`: a whole number or decimal that represents the vCPUs allocated to the service when it runs.

```yaml
cpu: 1
```

`memory`: a string that represents the memory allocated to the service when it runs.

```yaml
memory: 2GB
```

**Note for ECS platforms only:**
When deploying to platforms of type ECS, there are constraints in the underlying provider that require `cpu` and `memory` to be correlated. In the table below you can find the required memory values for a given vCPU value. See [underlying ECS constraints here](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html).

| cpu | memory |
| ----- | ----------- |
| .25   | 0.5GB, 1GB, 2GB |
| .5  | 1GB, 2GB, 3GB, 4GB |
| 1  | 2GB, 3GB, 4GB, 5GB, 6GB, 7GB, 8GB |
| 2 | 4GB - 16GB (in increments of 1GB) |
| 4 | 8GB - 30GB (in increments of 1GB) |

### depends_on

`depends_on` takes an array of references to other services within the component. These dictate startup order: at deployment time, services will not be started until any of their listed dependents have already started.

```yaml
services:
  app: # here, app will not start until my-api and db have started
    depends_on:
      - my-api
      - db
    interfaces:
      postgres: 5432
  my-api: # here, my-api will not start until db has started
    depends_on:
      - db
    interfaces:
      admin: 8081
  db:
    interfaces:
      postgres: 5432
```

Note: Circular dependencies and self-references are detected and rejected at component registration time.
