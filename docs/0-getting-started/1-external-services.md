---
title: Connecting to external services
---

# Existing database

```yaml
name: component/name

parameters:
  existing_rds_host:
  
services:
  db:
    image: postgres:13
    interfaces:
      main:
        host: ${{ parameters.existing_rds_host }}
        port: 5432
    environment:
      
```

TODO: Include UI results, and in the future include how to do it via the UI

# Non-containerized application

* Might be legacy, might be lambda, etc.

```yaml
name: component/name

parameters:
  existing_rds_host:
  
services:
  db:
    image: postgres:13
    interfaces:
      main:
        host: ${{ parameters.existing_rds_host }}
        port: 5432
```

```sh
$ architect deploy ./architect.yml -p existing_rds_host=rds.aws.com.....
```
