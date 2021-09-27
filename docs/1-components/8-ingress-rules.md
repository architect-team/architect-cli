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

### Whitelisting IP Addresses

Ingresses of Architect components can be whitelisted by IP addresses on an individual basis. An example of a component where only users at the IP address 100.100.100.100 can access the `app` endpoint is shown below.

```yaml
name: example/component

services:
  frontend:
    interfaces:
      app: 8080

interfaces:
  app:
    url: ${{ services.frontend.interfaces.app.url }}
    ingress:
      ip_whitelist:
        - 100.100.100.100
```

Note that if you wish to use this feature on an EKS platform, manual changes must be made. Once platform apps are installed to the corresponding Architect platform, find the target groups that were created in your VPC that begin with the prefix `k8s-arcmanag-traefik`. Under the `Attributes` tab, make sure that `Proxy protocol v2` and `Preserve client IP addresses` are set to `Enabled`.
