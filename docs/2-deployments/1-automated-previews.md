---
title: Automated preview environments
---

# Automated preview environments

One of the largest benefits of Architects framework is that provisioning new environments is **always** limited to a single step, `architect deploy`. No matter how complex the application is or how many [dependencies](/docs/configuration/dependencies) it has, `architect deploy` is able to automatically provision it in a new environment.

What this means is that not only can developers run the stack privately, but the stack can also be provisioned automatically whenever there is a new branch or pull request. This automation is perfect for creating _previews_ of impending code changes so that product managers can review and integration tests can be run end to end.

## Github Actions

### Create preview environment

The workflow below can be pasted into a file in your repository in the `.github` folder to trigger automated preview environments via Architect. These previews will be created whenever a pull request is submitted that targets the master branch. Be sure to set values in Github Secrets for the architect fields: `ARCHITECT_EMAIL` and `ARCHITECT_PASSWORD`. Replace `<account-name>`, `<platform-name>`, and `<component-name>` with the appropriate values.

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
          email: ${{ secrets.ARCHITECT_EMAIL }}
          password: ${{ secrets.ARCHITECT_PASSWORD }}
          account: <account-name>
          platform: <platform-name>
          environment: preview-${{ github.event.number }}
          component_name: <component-name>
```

### Cleanup preview environment

You certainly don't want your auto-generated preview environments to remain live forever eating up valuable cluster resources. Paste the snippet below into another Github workflow file in your repository to cleanup preview environments triggered on pull requests whenever the PRs close:

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
          email: ${{ secrets.ARCHITECT_EMAIL }}
          password: ${{ secrets.ARCHITECT_PASSWORD }}
          account: <account-name>
          environment: preview-${{ github.event.number }}
          component_name: <component-name>
```

## Gitlab CI

This job can be pasted into your `.gitlab-ci.yml` at the root of your repository. You are welcome to change the `stage` to whatever fits your needs to allow you to run tests before the preview is generated, and please be sure to assign correct values for the variables in the job. Additionally, you'll need to assign values for variables in the below config not prefixed with `$CI_` in your repository's CI variables configuration so that the architect commands will run successfully.

This configuration takes advantage of GitLab environments in order to give you better control and visibility into what environments exist and what's deployed to them. On PR creation, both a GitLab and Architect environment will be created. The component specified in the repository will be registered with the Architect Cloud and deployed to the environment. When the PR is either merged or closed, the GitLab environment will be automatically deleted and the component deployed to the environment in the Architect Cloud will be destroyed.

```yaml
# this example assumes that the repo has ARCHITECT_ACCOUNT and ARCHITECT_PLATFORM set as CI/CD variables
stages:
  - preview

default:
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - apk add --update npm git
    - apk add yq --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community
    - npm install -g @architect-io/cli
    - architect login -e $ARCHITECT_EMAIL -p $ARCHITECT_PASSWORD

deploy_preview:
  stage: preview
  variables:
    ARCHITECT_ENVIRONMENT: preview-$CI_MERGE_REQUEST_ID
    ARCHITECT_COMPONENT_NAME: <your/component:here>
    ARCHITECT_DEPLOY_FLAGS: -i your-interface:your-interface -p PARAM_A=some_value PARAM_B=another_value
  script: |
    architect register architect.yml --tag $ARCHITECT_ENVIRONMENT
    architect environment:create $ARCHITECT_ENVIRONMENT || true
    architect deploy --auto_approve --account $ARCHITECT_ACCOUNT --environment $ARCHITECT_ENVIRONMENT $ARCHITECT_COMPONENT_NAME
  environment:
    name: architect/preview-$CI_MERGE_REQUEST_ID
    url: https://cloud.architect.io/$ARCHITECT_ACCOUNT/environments/preview-$CI_MERGE_REQUEST_ID/
    on_stop: destroy_preview
  rules:
    - if: $CI_MERGE_REQUEST_ID

destroy_preview:
  stage: preview
  variables:
    ARCHITECT_ENVIRONMENT: preview-$CI_MERGE_REQUEST_ID
    ARCHITECT_COMPONENT_NAME: <your/component:here>
  script: |
    architect destroy --auto_approve --environment $ARCHITECT_ENVIRONMENT --component $ARCHITECT_COMPONENT_NAME
    architect env:destroy --auto_approve $ARCHITECT_ENVIRONMENT
  environment:
    name: architect/preview-$CI_MERGE_REQUEST_ID
    action: stop
  rules:
    - if: $CI_MERGE_REQUEST_ID
      when: manual
```
