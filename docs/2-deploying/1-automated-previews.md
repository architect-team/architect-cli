---
title: Automated preview environments
---

# Automated preview environments

One of the largest benefits of Architects framework is that provisioning new environments is **always** limited to a single step, `architect deploy`. No matter how complex the application is or how many [dependencies](/docs/configuration/dependencies) it has, `architect deploy` is able to automatically provision it in a new environment.

What this means is that not only can developers run the stack privately, but the stack can also be provisioned automatically whenever there is a new branch or pull request. This automation is perfect for creating _previews_ of impending code changes so that product managers can review and integration tests can be run end to end.

## Create preview environment

### Github Actions

The workflow below can be pasted into a file in your repository in the `.github` folder to trigger automated preview environments via Architect. These previews will be created whenever a pull request is submitted that targets the master branch. Be sure to set values in Github Secrets for the architect fields: `EMAIL`, `PASSWORD`, `ACCOUNT`, `PLATFORM`, and `COMPONENT_NAME`.

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

### Gitlab CI

This job can be pasted into your `.gitlab-ci.yml` at the root of your repository. You are welcome to change the `stage` to whatever fits your needs to allow you to run tests before the preview is generated, and please be sure to assign correct values for the `variables` in the job. Additionally, you'll need to assign values for `ARCHITECT_EMAIL` and `ARCHITECT_PASSWORD` in your repositories CI variables configuration so that `architect login` will complete successfully.

```yaml
preview:
  stage: deploy
  image: docker:latest
  services:
    - docker:dind
  only:
    - merge_requests
  variables:
    ARCHITECT_ACCOUNT: my-account
    PREVIEW_PLATFORM: architect
    PREVIEW_TAG: $CI_MERGE_REQUEST_SOURCE_BRANCH_NAME
  before_script:
    - apk add --update npm git
    - apk add yq --repository=http://dl-cdn.alpinelinux.org/alpine/edge/community
    - npm i -g @architect-io/cli --unsafe-perm
    - architect login -e $ARCHITECT_EMAIL -p $ARCHITECT_PASSWORD
  script:
    # Use the yq library to extract the name of the component
    - export FULL_COMPONENT_NAME=$(yq r ./architect.yml name)
    # Remove the account name from the component name lifted from the manifest
    - export COMPONENT_NAME=${FULL_COMPONENT_NAME##*/}
    # Register the component
    - architect register . -t $PREVIEW_TAG
    # Create a preview environment if one doesn't already exist
    - architect env:create $COMPONENT_NAME-$CI_MERGE_REQUEST_ID -a $ARCHITECT_ACCOUNT --platform $PREVIEW_PLATFORM || echo "Preview environment already exists. Deploying to it now."
    # (optional) extract the interfaces from the manifest so we can automatically expose them
    - >
      export INTERFACES=""
      for i in $(yq r --printMode p ./src/product-catalog/architect.yml "interfaces.*"); do
        export INTERFACES="$INTERFACES-i ${i#"interfaces."}:${i#"interfaces."} "
      done
    # Deploy the component to the preview environment
    - architect deploy $FULL_COMPONENT_NAME:$PREVIEW_TAG -e $COMPONENT_NAME-$CI_MERGE_REQUEST_ID -a $ARCHITECT_ACCOUNT --auto_approve $INTERFACES
```

## Cleanup preview environment

### Github Actions

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
          email: ${{ secrets.EMAIL }}
          password: ${{ secrets.PASSWORD }}
          account: ${{ secrets.ACCOUNT }}
          environment: preview-${{ github.event.number }}
          component_name: ${{ secrets.COMPONENT_NAME }}
```
