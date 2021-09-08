---
title: Ingress rules
---

# API Gateway Ingress Rules

A common need for applications is to expose themselves to outside traffic. Public facing webapps and APIs are the primary means by which end users interact with applications, so its important for components to be able to declare this need. To expose your app or API to outside traffic, all you need to do is declare an ingress rule for your component interface. Right now there is only one ingress rule field of note: `subdomain`.

Every environment gets allocated a base URL used to fulfill all ingress traffic in an environment. This base URL combined with the various ingress rules are used to configure the API gateway installed on the platform to faciliate and broker secure traffic from the outside world to internal apps and services. Below is an example of a component that declares a single interface with an attached ingress rule:

```yaml
name: example/component

parameters:
  ingress_subdomain:
    default: app
    description: Subdomain to listen for requests on

services:
  frontend:
    interfaces:
      app: 8080
      
interfaces:
  app:
    url: ${{ services.frontend.interfaces.app.url }}
    ingress:
      subdomain: ${{ parameters.ingress_subdomain }}
```

The above component declares a configurable ingress rule to listen on a subdomain (by default, "app"). You can then deploy the component with a single line into an environment and it will automatically be exposed via the API gateway:

```sh
# The following command will expose the interface at https://app.dev.example.arc.domains
$ architect deploy example/component:latest -a example -e dev
```
