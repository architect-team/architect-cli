---
title: Parameters
---

# Parameters

Components can define configurable parameters that can be used to enrich the contained services with credentials or alter the behavior of the serivces.

```yaml
parameters:
  param_key:
    default: default-value
    description: My description
    required: true
```

In order to make it easier to describe parameters, Architect also supports a shorthand that allows developers to quickly assign default values:

```yaml
parameters:
  param_key: default-value
```

## description

A human-readable description of the parameter. Use this to inform users of what the desired value should be.

## default

A default value to assign to the parameter when one wasn't provided

## required

A boolean value indicating whether or not users are required to provide a value.
