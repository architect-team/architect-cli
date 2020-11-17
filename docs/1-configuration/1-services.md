---
title: Services
---

# Services

Services describe the runtimes that power your application. Each service described in an `architect.yml` file will automatically be deployed to its own horizontally scaling replica with load balanced seamlessly between instances.

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

## build

(optional) An object containing the details necessary for Architect to build the service via Docker. Whenever a service that specifies a `build` field is registered with Architect, the CLI will trigger a `docker build` and replace the `build` field with a resolvable [image](#image).

```yaml
build:
  # The path to the directory containing the source code relative to the architect.yml file
  context: ./

  # The path to the Dockerfile relative to the build.context (default: Dockerfile)
  dockerfile: Dockerfile
```

_This field cannot be used in conjunction with the `image` field_

## image

(optional) A string referencing the address of an existing docker image that powers this service.

_This field cannot be used in conjunction with the `build` field_

## command

(optional) A string or string[] specifying the command to be used to start up the service inside the container. If no value is specified, the default `CMD` from the associated image will be used.

## entrypoint

(optional) A string or string[] specifying the entrypoint to be used to start up the service inside the container. If no value is specified, the default `ENTRYPOINT` from the associated image will be used.

## interfaces

A dictionary containing a set of named interfaces that the service listens for requests on. Each interface must at minimum specify the port it is listening for requests on.

```yaml
interfaces:
  public:
    # (required) Port that the service is listening for traffic on
    port: 8080

    # Protocol that the interface responds to (default: http)
    protocol: http

    # The host address of an existing service to use instead of provisioning a new one
    host: rds.amazonwebservices.com
```

Since many services use http for traffic, interfaces also support a simple short-hand for specifying the service port:

```yaml
interfaces:
  public: 8080
```

## environment

A key-value store of environment variables to be injected into the service runtime.

```yaml
environment:
  NODE_ENV: dev
  STRIPE_API_KEY: abc-123
```

## volumes

(optional) A dictionary containing a set of named volumes that the service will request and mount to each service instance.

```yaml
volumes:
  tmp-imgs:
    # Directory at which the volume will be mounted inside the container
    mount_path: /usr/app/images

    # (optional) Human-readable description of volume
    description: Description of my volume

    # (optional) A directory on the host machine to sync with the mount_path on the docker image.
    # This is primarily used for local debugging.
    host_path: ./relative/to/architect.yml
```

## debug

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
