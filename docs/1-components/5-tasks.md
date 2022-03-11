---
title: Tasks
---

# Tasks

There are some scripts and processes that support applications that don't serve traffic and aren't intended to be run as persistent services. Sometimes developers might need to execute these tasks manually at their discression, and sometimes they might want them to be run on a schedule.

By defining task definitions inside Architect components, developers can make use of all the same service discovery and security benefits afforded to persistent services – making it much easier and safer to execute tasks. This coupling of tasks and components means the component must be redeployed to an environment before the new version of the task can be run.

```yaml
name: account/component

services:
  database:
    image: postgres:11
    interfaces:
      pg:
        protocol: postgres
        port: 5432

tasks:
  run-reports:
    # run every sunday at 3am
    schedule: 0 3 * * 0
    build:
      context: .
    command: node run-reports.js
    environment:
      DB_ADDR: ${{ services.database.interfaces.pg.url }}
```

## Configuration options

### schedule

A cron string indicating the schedule at which the task will run. Architect will ensure the cron jobs are instrumented correctly regardless of where the task is deployed.

_Note: the schedule is ignored when running locally since the environments are temporary and primarily used for debugging. To test your tasks, [try executing them manually](#manual-execution)_

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

### environment

A key-value store of environment variables to be injected into the service runtime.

```yaml
environment:
  NODE_ENV: dev
  STRIPE_API_KEY: abc-123
```

## Local development

When developing your task locally you may want to mount volumes or alter the command that is used in remote environments. Learn more about how to specify with [local configuration](../local-configuration).

## Manual execution

Anyone with access to an environment that includes a task will be able to execute it manually with Architect's CLI using the following command:

```yaml
$ architect task:exec account/component run-reports --account="my-account" --environment="my-environment"
```

`account/component` is the name of the component that contains the task, `run-reports` is the name of the task to execute, and the `--account` and `--environment` fields are used to target an environment that contains an instance of the component.
