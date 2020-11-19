---
title: 'Deployment Validation'
symlinks:
  - /reference/validation
---

# Deployment Validation

Deployment validators on the Architect Cloud guarantee that deployments will function as expected once applied.

## ECS requires specific values for CPU and memory

<pre>
severity: error
target: ECS
</pre>

All services deployed to ECS should specify valid CPU and memory specs for the
service to be run. Otherwise, defaults of 0.5 CPU and 1gb memory will be
applied. Options can be found on the table
[here](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-cpu-memory-error.html).

```yaml
# component spec
# ...
services:
  api:
    cpu: 1
    memory: 512mb
# ...
```

## ECS zone per custom domain

<pre>
severity: error
target: ECS
</pre>

Interfaces in an environment config which define custom domains must have equivalent AWS Hosted Zones defined. Each domain itself must also specify an NS record pointing to the DNS servers defined in the corresponding Zone. For more information, see TODO: insert CLI docs link here##################

```yaml
# environment spec
# ...
interfaces:
  api:
    domains:
      - staging.architest.dev
# ...
```
