---
title: Automated preview environments
---

# Automated preview environments

One of the largest benefits of Architects framework is that provisioning new environments is **always** limited to a single step, `architect deploy`. No matter how complex the application is or how many [dependencies](/docs/configuration/dependencies) it has, `architect deploy` is able to automatically provision it in a new environment.

What this means is that not only can developers run the stack privately, but the stack can also be provisioned automatically whenever there is a new branch or pull request. This automation is perfect for creating _previews_ of impending code changes so that product managers can review and integration tests can be run end to end.

## Github Actions

### Create preview environment

```yaml
name: Architect Create Preview

on:
  pull_request:
    branches:
      - master

jobs:
  architect_create_preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v1
      - name: Architect Create Preview
        uses: architect-team/create-preview@v1.0.1
        with:
          email: ${{ secrets.EMAIL }}
          password: ${{ secrets.PASSWORD }}
          account: ${{ secrets.ACCOUNT }}
          environment: preview-${{ github.event.number }}
          platform: ${{ secrets.PLATFORM }}
          component_name: ${{ secrets.COMPONENT_NAME }}
```

### Cleanup preview environment

```yaml
name: Architect Destroy Preview

on:
  pull_request:
    branches:
      - master
    types:
      - closed

jobs:
  architect_destroy_preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v1
      - name: Architect Destroy Preview
        uses: architect-team/destroy-preview@v1.0.1
        with:
          email: ${{ secrets.EMAIL }}
          password: ${{ secrets.PASSWORD }}
          account: ${{ secrets.ACCOUNT }}
          environment: preview-${{ github.event.number }}
          component_name: ${{ secrets.COMPONENT_NAME }}
```

## CircleCI

CircleCI doesn't support triggers based on pull request, so we'd recommend a branch based strategy to trigger preview environments. Any branches prefixed with `preview-` will trigger the creation of an associated preview environment.

TODO
