---
title: Parameters
---

# Defining Parameters

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

# Assigning parameter values

To learn more about assigning values for parameters, see the docs on environment configuration:

[Environment Configuration](/deployments/environment-configuration)
