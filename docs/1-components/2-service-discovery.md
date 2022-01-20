---
title: Service discovery
---

# Service discovery

Service discovery is the process by which services in an environment can be automatically identified and connected to. This includes simple connections like an API connecting to its database, as well as more complex connections like a web of related microservices.

Service discovery is a powerful feature, and Architect makes it easier than ever for developers to take advantage of it. Instead of having to learn about the wide array of service discovery tools available on the market, developers can simply connect services together using Architects expression syntax. When Architect resolves these references, it will automatically instrument service discovery to ensure that these services can communicate in a performant way.

## Utilizing service discovery

```yaml
services:
  database:
    image: postgres:11
    interfaces:
      pg:
        protocol: postgres
        port: 5432

  my-api:
    build:
      context: .
    environment:
      # Automatically resolves to the full addess of the database service
      DATABASE_ADDR: ${{ services.database.interfaces.pg.url }}
```

The above example describes two services: a database service and an API service that contains our custom code. Normally we'd have to deploy the database service first, get its resolvable address, and then inject it into the environment parameters for the API when we deploy that next. With Architect however, all those steps are automated for you.

As you can see from the above example, we've set the value of the `DATABASE_ADDR` environment parameter to be `${{ services.database.interfaces.pg.url }}`, which is a reference to the interface in the included database service. This particular value will resolve to something like `postgres://database.local:5432`.

By referencing a peer service in this way, Architect is able to resolve this reference to the appropriate value based on the service discovery technology available in the target environment. Locally this might mean it resolves to a peer docker-compose service, in Kubernetes it might use the k8s embedded service discovery, or in more complex use-cases it may use a custom tool set entirely. In any case, developers no longer need to worry about the tools or processes since Architect will enrich the value for them.

## Service referencing syntax

It is extremely common for developers to connect to peer services and interfaces, and the `${{ services.*.interfaces.* }}` expression context is available for exactly this purpose. Developers can reference service interfaces by name using this format, and then will have access to the following fields attached to the interface:

| field | description |
| ----- | ----------- |
| url   | The fully composed URL of the reference interface. This will take the format, `<protocol>://<username>:<password>@<host>:<port><path>`. |
| protocol | The protocol of the interface being referenced. This will always be the specific value assigned to the interface by the developer. |
| username | The username of the interface being referenced. Not all interfaces have usernames, so this will be an empty string if none is set. |
| password | The password of the interface being referenced. Not all interfaces have passwords, so this will be an empty string if none is set. |
| host  | The host value of the interface being referenced. This value is usually dynamic to accomodate the differences between service discovery solutions available to each environment. |
| port  | The port value of the interface being referenced. This will not always be the specific port that the interface is listening on as many container platforms leverage port mapping to ensure that there are no port collisions when sharing hardware in a cluster. |
| path  | The path value of the interface being referenced. Not all interfaces have paths, so this will be an empty string if none is set. |
