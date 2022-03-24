---
title: GitOps releases
---

# GitOps releases

In the previous doc you learned how to automate preview environments on pull requests. In this doc, you'll learn how to create additional GitOps workflows that promote your code to staging when pull requests are merged, and production when new releases are cut.

## Sync staging with master

The best way to maintain a staging environment is by syncing it with your mainline git branch - every time a change is made to `master`, trigger a deploy to staging. Whether through direct pushes or successful pull requests, this will ensure that the staging environment always mirrors the `master` branch of your repo.

The workflows below will first create a new `latest` tag of your component in Architects registry. Then it will trigger `architect deploy` to ship that component and its changes to an existing `staging` environment. This environment is not created by this workflow since it is intended to be persistent, so you'll have to create the environment in advance.

> `ARCHITECT_PASSWORD` must be a <a href="https://cloud.architect.io/users/me/access-tokens" target="_blank">personal access token</a>.

### Github Actions

```yaml
name: Deploy master

env:
  ARCHITECT_EMAIL: ${{ secrets.ARCHITECT_EMAIL }} # pass secrets into a job from Github > Settings > Secrets
  ARCHITECT_PASSWORD: ${{ secrets.ARCHITECT_PASSWORD }}
  ARCHITECT_ACCOUNT: <account-name>
  MAINLINE_TAG_NAME: latest

on:
  push:
    branches:
      - main

jobs:
  architect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - name: Tests
        run: echo "Run your tests here"
      - name: Install Architect CLI
        run: sudo npm install -g @architect-io/cli
      - name: Login to Architect Cloud
        run: architect login # credentials loaded automatically from envs ARCHITECT_EMAIL/ARCHITECT_PASSWORD
      - name: Tag and Register Component
        run: architect register ./architect.yml --tag ${{ env.MAINLINE_TAG_NAME }}
      - name: Deploy to Staging
        run: |
          architect deploy --environment staging --auto-approve examples/my-component:${{ env.MAINLINE_TAG_NAME }}
```

## Cut releases for production

The last step of your GitOps workflow is to finally get your code into production! If you want, you're welcome to use the workflow described previously to automatically deploy from `master` straight to production, but in this workflow we'll show how to trigger the deployment on a manual release cut. By triggering on new releases, we can log a version history of all the code that made its way to production to make it easier to instrument rollbacks.

The workflows below will first register the component with a tag matching the name of the new release. Then they will deploy the new component tag to an environment named `production`. Obviously production is intended to be persistent, so you'll have to create the environment in advance.

> `ARCHITECT_PASSWORD` must be a <a href="https://cloud.architect.io/users/me/access-tokens" target="_blank">personal access token</a>.

### Github Actions

```yaml
name: Deploy release

env:
  ARCHITECT_EMAIL: ${{ secrets.ARCHITECT_EMAIL }} # pass secrets into a job from Github > Settings > Secrets
  ARCHITECT_PASSWORD: ${{ secrets.ARCHITECT_PASSWORD }}
  ARCHITECT_ACCOUNT: test

on:
  release:
    types:
      - published
    branches:
      - main
    tags:
      - v*.*.*

jobs:
  architect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '14'
      - name: Tests
        run: echo "Run your tests here"
      - name: Install Architect CLI
        run: sudo npm install -g @architect-io/cli
      - name: Login to Architect Cloud
        run: architect login # credentials loaded automatically from envs ARCHITECT_EMAIL/ARCHITECT_PASSWORD
      - name: Tag and Register Component
        run: architect register ./architect.yml --tag ${{ github.event.release.tag_name }}
      - name: Deploy to Production
        run: |
          architect deploy --environment production --auto-approve examples/my-component:${{ github.event.release.tag_name }}
```
