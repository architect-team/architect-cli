---
title: Configuring the API gateway
---

```yaml
name: architect/cloud

parameters:
  ingress_subdomain: cloud
  ingress_enabled: true

services:
  frontend:
    interfaces:
      app: 8080
      
interfaces:
  app:
    url: ${{ services.frontend.interfaces.app.url }}
    ingress:
      subdomain: ${{ parameters.ingress_subdomain }}
      enabled: ${{ parameters.ingress_enabled }}
```

```sh
$ architect deploy ./architect.yml
```
