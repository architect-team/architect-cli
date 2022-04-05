---
title: Services
---

# Services

Services describe the runtimes that power your application. Each service described in an `architect.yml` file will automatically be deployed to its own horizontally scaling replica with load balancing seamlessly between instances.

```yaml
name: examples/my-component

services:
  my-api:
    build:
      context: ./path/to/docker/build/context
      dockerfile: ./relative/to/context/Dockerfile
    command: npm start
    entrypoint: entrypoint override for dockerfile ENTRYPOINT
    environment:
      DB_ADDR: rds.amazonwebservices.com/db-name
      DB_USER: postgres
      DB_PASS: password
    interfaces:
      public:
        port: 8080
        protocol: http
      admin: 8081
    labels:
      architect.io/environment: dev
      architect.io/service: api
    liveness_probe:
      port: 8080
      path: /health
    replicas: 2
    cpu: 1
    memory: 512mb
    # Local configuration for my-api service
    ${{ if architect.environment == 'local' }}:
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
    username: ${{ secrets.API_USERNAME }}

    # (optional) A basic auth password required to access the interface
    password: ${{ secrets.API_PASSWORD }}

    # (optional) Specific path that the service is listening on
    path: /api

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
secrets:
  postgres_host:
    required: false
...
services:
  api-db:
    image: postgres:11
    interfaces:
      postgres:
        host: ${{ secrets.postgres_host }}
        port: 5432
        protocol: postgresql
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: architect
      POSTGRES_DB: architect_postgres_db
...
```

The secret `postgres_host` will determine whether or not the service will be provisioned by Architect. If `postgres_host` is not set, Architect will provision the `api-db` service and create a `postgres:11` container. If the `postgres_host` secret is set, `image: postgres:11` will be ignored and the container will not be provisioned by Architect. Any interpolated values that include the `api-db` service will produce the correct output in either instance with the difference being that `${{ services.api-db.interfaces.postgres.host }}` and `${{ services.api-db.interfaces.postgres.url }}` will change based on the `host` of the interface. Note that if a service has multiple interfaces and you would like to reference an external service, all of the Architect service's interfaces must specify the `host` override.

### labels
Dictionary of string keys and values that can be used to organize and categorize (scope and select) the service.

Syntax and character set
Labels are key/value pairs. Valid label keys have two segments: an optional prefix and name, separated by a slash (/). The name segment is required and must be 63 characters or less, beginning and ending with an alphanumeric character ([a-z0-9A-Z]) with dashes (-), underscores (_), dots (.), and alphanumerics between. The prefix is optional. If specified, the prefix must be a DNS subdomain: a series of DNS labels separated by dots (.), not longer than 63 characters in total, followed by a slash (/).

Valid label value:
must be 63 characters or less (can be empty),
unless empty, must begin and end with an alphanumeric character ([a-z0-9A-Z]),
could contain dashes (-), underscores (_), dots (.), and alphanumerics between.

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
    key: my-compose-volume-name
```

#### Kubernetes

Kubernetes persistent volume claims can be created in advance of a deployment requiring volumes. Be sure to create the claim(s) in the same namespace that the services will be created in. An example of a persistent volume configuration that can be applied to a cluster namespace is below:

```yml
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
  name: my-claim
  namespace: my-namespace
spec:
  storageClass: "" # Set this to a storage class that supports the access modes below
  accessModes:
    - ReadWriteMany # The default PVC storage class must support this access mode
    - ReadOnlyMany # The default PVC storage class must support this access mode
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
      key: my-claim
...
```

Architect deployments to Kubernetes platforms also support dynamic volume provisioning. If an Architect service contains a volume that does not specify a `key` property, the volume will be created automatically at deploy time. An example of such a volume is below. Be sure that the Kubernetes cluster's default storage class includes both the `ReadWriteOnce` and `ReadOnlyMany` access modes and that the volume binding mode is set to `Immediate`.

```yml
...
  volumes:
    my-volume:
      # Directory at which the volume will be mounted inside the container
      mount_path: /usr/app/images
...
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

## Local development

When developing your service locally you may want to mount volumes or alter the command that is used in remote environments. Learn more about how to specify with [local configuration](/components/local-configuration).
