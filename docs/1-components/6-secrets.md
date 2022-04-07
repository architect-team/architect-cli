---
title: Secrets
---

# Defining Secrets

Components can define configurable secrets that can be used to enrich the contained services with credentials or alter the behavior of the serivces.

```yaml
secrets:
  secret_key:
    default: default-value
    description: My description
    required: true
```

In order to make it easier to describe secrets, Architect also supports a shorthand that allows developers to quickly assign default values:

```yaml
secrets:
  secret_key: default-value
```

# Assigning secret values

To learn more about assigning values for secrets, see the docs on environment configuration:

[Environment Configuration](/deployments/secrets)
