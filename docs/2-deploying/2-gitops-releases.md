---
title: GitOps releases
---

# GitOps releases

## Sync staging with master

```yaml
name: Deploy master

env:
  ARCHITECT_EMAIL: # Pass into job - don't hardcode
  ARCHITECT_PASSWORD: # Pass into job - don't hardcode
  ARCHITECT_ACCOUNT: test
  MAINLINE_TAG_NAME: latest

on:
  push:
    branches:
      - master

jobs:
  architect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: tests
        run: echo "Run your tests here"
      - name: login
        run: architect login # credentials provided by envs ARCHITECT_EMAIL/ARCHITECT_PASSWORD
      - name: Tag architect component
        run: |
          architect register --tag ${{ env.MAINLINE_TAG_NAME }} ./architect.yml
      - name: deploy to staging
        run: |
          architect deploy \
            --environment staging \
            --auto_approve \
            examples/my-component:${{ env.MAINLINE_TAG_NAME }}
```

## Cut releases for production

TODO
