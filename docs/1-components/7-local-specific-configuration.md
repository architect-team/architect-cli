---
title: Local-specific configuration
---

# Hot-reloading

```yaml
name: component/name

services:
  api:
    build:
      context: ./
    interfaces:
      api: 8080
    debug:
      build:
        dockerfile: Dockerfile.debug
      command: nodemon index.js
      volumes:
        src:
          host_path: #...
          mount_path: #...
```

# Attaching breakpoints

``yaml
name: component/name

services:
  api:
    build:
      context: ./
    interfaces:
      api: 8080
    debug:
      interfaces:
        debug: 9229
      command: node --brk-inspect index.js
```

# Persisting data

```yaml
name: postgres/postgres

services:
  db:
    image: postgres:13
    interfaces:
      postgres: 5432
    debug:
      volumes:
        data:
          mount_path: # ...
          host_path: # ...
```

# Connecting to a shared environment

Use cases like centralized QA environment, and existing, local DB

```yaml
name: postgres/postgres

parameters:
  local_db:

services:
  db:
    image: postgres:13
    interfaces:
      postgres:
        port: 5432
        host: ${{ parameters.local_db }}
```

# Testing production builds before landing in production

Sometimes you might want to test out the production deployment process before registering the component. To simulate the regular deployment flow, use the `--production` flag:

```sh
$ architect deploy --local ./architect.yml --production
```
