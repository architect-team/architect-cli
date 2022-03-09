---
title: architect.yml
symlinks:
  - /configuration/
---

# architect.yml

The `architect.yml` file is the manifest file that is used to describe Architect Components. Components described using this syntax can leverage the CLI and cloud platform to provision and update production-grade environments on-demand or via automation.

```yaml
name: account/component
description: Human-readable description of my component
keywords:
  - additional
  - search
  - keywords
parameters:
  db_user:
    required: true
    description: Human-readable description of my parameter
    default: default-value
  db_pass: shorthand-default-value
  db_name: example
services:
  database:
    image: postgres:11
    interfaces:
      pg:
        port: 5432
        protocol: postgres
    environment:
      POSTGRES_USER: ${{ parameters.db_user }}
      POSTGRES_PASSWORD: ${{ parameters.db_pass }}
      POSTGRES_DATABASE: ${{ parameters.db_name }}
  my-api:
    depends_on:
      - database
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
      DB_ADDR: ${{ services.database.interfaces.pg.url }}/${{ parameters.db_name }}
      DB_USER: ${{ parameters.db_user }}
      DB_PASS: ${{ parameters.db_pass }}
  my-frontend:
    build:
      context: .
    interfaces:
      webapp: 3000
    liveness_probe:
      port: 3000
      path: /health
    environment:
      API_ADDR: ${{ services['my-api'].interfaces.public.url }}
    # Local configuration for my-frontend service
    ${{ if architect.environment == 'local' }}:
      command: npm run dev
      volumes:
        src:
          description: Mount the src directory to the container from the host when running locally
          host_path: ./src
          mount_path: /usr/app/src
interfaces:
  upstream:
    description: Maps the frontend to a component-level interface so it can be consumed by others
    url: ${{ services['my-frontend'].interfaces.webapp.url }}
```

## Configuration options

### name

Name of the component that can be resolved by others. Component names must be unique, and must be prefixed with the name of an Architect account.

### description

(optional) A human-readable description of the component. This will be rendered when others view the component so that they know what it should be used for.

### keywords

(optional) Additional search terms to be used when the component is indexed so that others can find it more easily.

### services

A dictionary of named runtimes for the component. Each service described in an `architect.yml` file will be automatically deployed to your container platform and registered with your service mesh and API gateway as needed.

[Learn more about configuring services](1-services.md)

### interfaces

A dictionary of named gateways that broker access to the services inside the component. Services inside the same component can always connect to one another via [service discovery](2-service-discovery.md), but without an interface at the component-level, services will not be able to be resolved by any outside users or applications. Interfaces allow components to advertise the features that they want others to be able to connect to.

[Learn more about configuring interfaces](3-interfaces.md)

### dependencies

A key-value store of components and their respective tags that this component depends on. Dependency referencing and resolution is a key feature of Architect that enables distribute teams to collaborate without having to get into the specifics of how to operate dependencies.

[Learn more about configuring dependencies](4-dependencies.md)

### tasks

A dictionary of named tasks included with the component. Each task described in an `architect.yml` file will run on its specified schedule and/or be made available as an executable via Architects CLI upon deployment.

[Learn more about configuring tasks](5-tasks.md)

### parameters

(optional) A dictionary of named, configurable fields for the component. Each parameter can include a description so that others know what to assign for values, a default value for when deployers don't specify one, and an indication as to whether or not a value is required.

[Learn more about configuring parameters](6-parameters.md)
