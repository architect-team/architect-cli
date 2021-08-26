---
title: Environment configuration
---

# Defining component parameters

```yaml
# architect.yml
name: examples/component
dependencies:
  TODO/TODO: latest
parameters:
  secret_key:
    required: true
services:
  api:
    environment:
      SECRET_KEY: ${{ parameters.secret_key }}
```

# Specifying parameter values for an environment

## From the command line

```yaml
# values.yml
'examples/component:*':
  secret_key: value
'TODO/TODO:*':
  key: value
```

## From the UI

![Secret Manager](./images/secret-manager-screenshot.png)
