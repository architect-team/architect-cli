---
title: Dependencies
---

# Dependencies

Architect was designed with the future in mind, and the future of any team building distributed software is a complex web of services. Historically this complex web of services has been hard to manage, hard to reason about, and hard for developers to contribute to.

Fortunately, the graphing and collaboration problems this creates have been solved before. We've seen it with object-oriented programming and inheritance, and even more recently with package and dependency management. All of our favorite languages have a way for developers to utilize dependencies through a resolver to handle the artifact storage, complex graphing, and de-duplication needed to manage them at-scale. Architect takes this same approach to make it easier than ever for developers to extend cloud services.

## Utilizing dependencies

```yaml
dependencies:
  architect/authentication: 1.2.1

services:
  my-api:
    interfaces:
      http: 8080
    environment:
      AUTH_ADDR: ${{ dependencies['architect/authentication'].interfaces.auth.url }}
```

Just like with your favorite package manager, developers can cite the names and versions of the components that they need to make calls to. Not only will this allow Architect to provision the dependency automatically, it will also allow developers to pin to specific versions and ensure that the APIs don't change out from under them.

## Dependency referencing syntax

We've already shown how Architect enables developers to take advantage of [service discovery](/1-components/2-service-discovery.md) for connecting to peer services, and the same approach can be used to connect to the interfaces of component dependencies. Once you've specified a dependency in your component, you can reference the interfaces of said dependency using the `${{ dependencies.*.interfaces.* }}` expression context.

Referencing component-level interfaces is the same as referencing service-level interfaces, and all the same fields are available to developers for referencing:

| field    | description                                                                                                                                                                                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| url      | The fully composed URL of the reference interface. This will take the format, `<protocol>://<username>:<password>@<host>:<port><path>`.                                                                                                                          |
| protocol | The protocol of the interface being referenced. This will always be the specific value assigned to the interface by the developer.                                                                                                                               |
| username | The username of the interface being referenced. Not all interfaces have usernames, so this will be an empty string if none is set.                                                                                                                               |
| password | The password of the interface being referenced. Not all interfaces have passwords, so this will be an empty string if none is set.                                                                                                                               |
| host     | The host value of the interface being referenced. This value is usually dynamic to accomodate the differences between service discovery solutions available to each environment.                                                                                 |
| port     | The port value of the interface being referenced. This will not always be the specific port that the interface is listening on as many container platforms leverage port mapping to ensure that there are no port collisions when sharing hardware in a cluster. |
| path     | The path value of the interface being referenced. Not all interfaces have paths, so this will be an empty string if none is set.                                                                                                                                 |
