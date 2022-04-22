---
title: External services
---

# External services

Want to use an existing database instance in production? Perhaps you have a legacy application that can't be containerized? Don't worry, we've got you covered.

Every service interface in an Architect Component can declare a resolvable `host` property. By setting this property, Architect will skip the provisioning process for the cooresponding node and instead broker connectivity from consuming services directly to the specified host. This allows you to seamlessly integrate external or legacy applications into your new, cloud-native application architecture. We call this proces, **virtual nodes**.

## Existing database

Architect's recursive deployment process can easily spin up new end-to-end environments, but when migrating production to be managed by Architect you'll want to ensure the new environment uses the existing production state. Virtual nodes allow you to do just that by overriding the database interface with the address of the existing one. Here's an example:

```yaml
name: example/component
description: |
  An example component showing how to create a dockerized postgres instance for
  on-demand environments while enabling the production environment to use an
  existing database instance.

secrets:
  existing_pg_host:
    required: false
    description: |
      The address of an existing database host that houses data specific to the
      deployed environment. If left blank, a new database will be provisioned using
      Docker.
  db_user:
    default: architect
    description: |
      Username of the account used to access the database. When a new database is
      provisioned, this will act as the root username.
  db_pass:
    default: password
    description: |
      Password for the account used to access the database. When a new database is
      provisioned, this will act as the root password.
  db_name:
    default: example
    description: The name of the database containing the tables for this application.

services:
  db:
    image: postgres:13
    interfaces:
      main:
        host: ${{ secrets.existing_pg_host }}
        port: 5432
    environment:
      POSTGRES_USER: ${{ secrets.db_user }}
      POSTGRES_PASSWORD: ${{ secrets.db_pass }}
      POSTGRES_DB: ${{ secrets.db_name }}

  api:
    build:
      context: ./
    interfaces:
      main: 8080
    environment:
      DB_ADDR: ${{ services.db.interfaces.main.url }}
```

By default, the above component will be deployed with a new postgres instance automatically (deployed as a dockerized service). If you wish to connect to an existing instance however, all you have to do is assign a value for the secret at deploy-time:

```sh
$ architect deploy example/component -p existing_pg_host=<id>.rds.amazonaws.com
```

## Non-containerized application

Another use-case for virtual nodes is to connect to legacy, or otherwise non-containerized applications and workloads. By creating components for externally managed services, your team can more easily extend those services and create new cloud-native apps and APIs around them. Here's an example:

```yaml
name: example/virtual-component
description: An example component showing how to declare an externally managed service.

services:
  legacy-monolith:
    interfaces:
      main:
        protocol: https
        host: external-api.example.com
        port: 443

interfaces:
  api:
    description: Exposes the legacy application to other APIs in the environment for extension.
    url: ${{ services.legacy-monolith.interfaces.main.url }}
```

Now that you've created the virtual component, other developers can simply cite it as a dependency and extend it as they see fit:

```yaml
name: example/consumer
description: Connects to and extends the functionality of the legacy application.

depenedencies:
  example/virtual-component: v1

services:
  api:
    build:
      context: ./
    interfaces:
      main: 8080
    environment:
      LEGACY_API_ADDR: ${{ dependencies['example/virtual-component'].interfaces.api.url }}
```
