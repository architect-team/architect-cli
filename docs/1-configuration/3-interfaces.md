---
title: Interfaces
---

# Interfaces

Interfaces are the primary means by which services and components advertise their resolvable addresses to others. By advertising their functionality, they allow other services and components to connect to them. Services inside the same component can always connect to one another via [service discovery](/docs/how-it-works/service-discovery), but without an interface at the component-level, services will not be able to be resolved by any outside users or applications.

```yaml
interfaces:
  public:
    description: A human-readable description of the interface
    url: http://rds.amazonwebservices.com:8080
```

Interfaces at the service-level support a short-hand to quickly specify the listening port. Component-level interfaces support a similar shorthand, but instead of assigning to the `port` value, the short-hand maps to the `url` value. This can make it easier to create interfaces that map directly to the interfaces of a service inside the component:

```yaml
interfaces:
  public: ${{ services['my-service'].interfaces.api.url }}
```

## url

The address that the interface brokers traffic to. This will usually be a reference to a service interface inside the component.

## description

(optional) A human-readable description of the interface that informs users of what it should be used for.
