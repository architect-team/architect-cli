---
title: Local configuration
---

# Local-specific configuration

Day-to-day development is a big part of DevOps and release automation. If we can't trust that our development processes will result in successful production deployment, we'll find ourselves doubling the effort needed to create and deploy new services.

Architect Components help ensure consistency between local debugging and remote deployments by capturing infrastructure-agnostic architectural details. However, there remains important cases for differing build and run processes locally that are not suitable for remote deployments. In order to enable these different use cases, Architect services can specify a `debug` configuration block – a blanket way to override service/task configuration exclusively for debugging scenarios. In this guide, you'll learn how you can use this `debug` block to enable different key development features for your Component.

## Hot-reloading

The most common debugging requirement is the ability for a running application to respond live to changes made to the underlying source code, commonly referred to as "hot-reloading". Achieving hot-reloading in a containerized setting requires two key steps: mounting the code from your host machine with a directory inside the container, and running a version of your start command that will automatically rebuild the running application whenever it detects code changes.

Each language and framework has its own tools to detect and react to code changes. Below is an example of how to do so for a Node.js application:

```yaml
name: component/name
description: An example component that includes debugging details to faciliate hot-reloading

services:
  api:
    build:
      context: ./
    interfaces:
      api: 8080
    # Local configuration for api service
    ${{ if architect.environment == 'local' }}:
      build:
        # The main difference between the main dockerfile and the debug one is the need
        # to install `devDependencies`, which in this case includes the `nodemon` utility
        # used for hot-reloading.
        dockerfile: Dockerfile.debug
      # With `nodemon` installed, we can now use that to bootup our app and enable hot-reloading
      command: nodemon index.js
      # Lastly, we'll need to sync our local source code with the expected directory inside the
      # container. Otherwise, nodemon won't detect any changes after container startup.
      volumes:
        src:
          host_path: ./src/
          mount_path: /usr/src/app/
```

## Attaching breakpoints

Another common need for teams working on rapid code changes is the use of an IDE attached debugger and breakpoints. Two things are needed to accomplish this: exposure of the debugger port, and execution of a start command that includes a debugger. An example component specification is as follows:

```yaml
name: component/name

services:
  api:
    build:
      context: ./
    interfaces:
      api: 8080
    # Local configuration for api service
    ${{ if architect.environment == 'local' }}:
      # First thing we need to do is attach the debugger. Node has a handy built-in flag, `--inspect`.
      command: node --brk-inspect=0.0.0.0:9229 index.js
      # Next, we need to expose the port the debugger is listening on.
      interfaces:
        debug: 9229
```

Once the debugger port is exposed, you'll need to attach it to your IDE. Each IDE has different instructions for doing this, but you can see an example using VS Code in the following article: [How to debug a Node.js app in a docker container](https://blog.risingstack.com/how-to-debug-a-node-js-app-in-a-docker-container/).

## Persisting data

Containers are designed to be self-contained, but that means that when they disappear so do their filesystems. This can be a major nuisance for local dev since your database and other stateful services will lose their contents forcing you to go through the same workflows over and over.

In order to avoid this, you'll have to mount the data volume for the database to your host machine. Fortunately, this can be done easily with Architect:

```yaml
name: postgres/postgres

services:
  db:
    image: postgres:13
    interfaces:
      postgres: 5432
    # Local configuration for db service
    ${{ if architect.environment == 'local' }}:
      environment:
        PGDATA: /var/lib/postgresql/data/pgdata
      volumes:
        data:
          mount_path: /var/lib/postgresql/data/
          host_path: ./.data/
```

The above will store the contents in a `.data` directory relative to the architect.yml file. We recommend you add this directory to your gitignore so it doesn't get checked into version control.

## When is the `debug` block used?

The debug block is used whenever local source code is leveraged instead of built and published Component artifacts. This can happen either because you're deploying a component directly from source, or if you've used linking to use local code to fulfill dependency references:

```sh
# Deploying a component from source
$ architect dev ./architect.yml

# Linking a component and using by name
$ architect link ./architect.yml
$ architect deploy component/name
```

## How can I test non-debugging behavior locally?

Sometimes you might want to test out the production deployment process before registering the component. To simulate the regular deployment flow, use the `--environment` flag:

```sh
$ architect dev ./architect.yml --environment=production
```

This will cause ```${{ if architect.environment == 'local' }}``` to return false, which in return will not set the environment variable  ```PGDATA``` or mount the volume.
