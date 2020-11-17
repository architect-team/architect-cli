---
title: architect.yml
symlinks:
  - /configuration/
---

# architect.yml

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
      DB_ADDR: ${{ services.database.interfaces.pg.url }}/${{ parameters.db_name }}
      DB_USER: ${{ parameters.db_user }}
      DB_PASS: ${{ parameters.db_pass }}
  my-frontend:
    build:
      context: .
    interfaces:
      webapp: 3000
    environment:
      API_ADDR: ${{ services['my-api'].interfaces.public.url }}
    debug:
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

## name

Name of the component that can be resolved by others. Component names must be unique, and must be prefixed with the name of an Architect account.

## description

(optional) A human-readable description of the component. This will be rendered when others view the component so that they know what it should be used for.

## keywords

(optional) Additional search terms to be used when the component is indexed so that others can find it more easily.

## parameters

(optional) A key-value store of configurable fields for the component. Each parameter can include a description so that others know what to assign for values, a default value for when deployers don't specify one, and an indication as to whether or not a value is required.

```yaml
parameters:
  param_key:
    # A human-readable description
    description: My description

    # An indication of whether or not the field is required (default: false)
    required: true

    # A default value for the field if none is provided
    default: value

  # Parameters support a short-hand syntax that allows a default value to be set easily
  param2: default-value
```

## services

A dictionary of named runtimes for the component. Services are some of the most versatile entities in your `architect.yml`, so we've created a separate document outlining [how to configure services](/docs/configuration/services).
