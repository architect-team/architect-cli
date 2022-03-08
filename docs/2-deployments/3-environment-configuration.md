---
title: Environment configuration
---

# Environment configuration

If you've created a component already, you probably saw that components support [parameters](/1-components/6-parameters.md) to allow the runtimes to receive environment-specific configuration. This can be anything ranging from log levels to production database credentials. Whatever it may be, there are a number of ways for these parameter values to be provided, and this document will outline the available methods. We'll assume you have've registered the following two components:

```yaml
# ./component/architect.yml
name: examples/component
dependencies:
  examples/dependency: latest
parameters:
  secret_key:
    required: true
services:
  api:
    environment:
      SECRET_KEY: ${{ parameters.secret_key }}

# ./dependency/architect.yml
name: examples/dependency
parameters:
  username:
    required: true
  password:
    required: true
services:
  dependency:
    environment:
      USERNAME: ${{ parameters.username }}
      PASSWORD: ${{ parameters.password }}
```

## From the command line

The simplest way to specify parameter values for components is by doing so directly from the deploy command. The command supports a `--parameters, -p` flag that allows you to specify the parameter key and value as follows:

```sh
$ architect deploy examples/dependency -p username=my-username -p password=my-password
```

## Using a config file

Using the `--parameter` flag is great for specifying values for individual components, but doesn't allow you to specify values for component dependencies. In order to specify parameter values for your component AND its dependencies, something common when generating on-demand environments, you'll need to create a secrets file:

```yaml
# secrets.yml
examples/component:*:
  secret_key: my-secret-key
examples/dependency:*:
  username: my-username
  password: my-password
```

This file can then be specified directly in the deploy command to apply values to any components matching the keys in the file. The below will deploy examples/component, and since it depends on examples/dependency it will automatically be deployed as well. Each component matches a key in the file above so all the required parameters will be fulfilled.

```sh
$ architect deploy examples/component --secrets secrets.yml
```

The keys in the secrets file are simply patterns for matching components. Some examples are:

```yaml
myorg/*: # applies to all components of the `myorg` account
  ...
myorg/foo-api:*: # applies to all versions of the foo-api component
  ...
myorg/foo-api:latest*: # applies only to the latest version of the foo-api component
  ...
myorg/foo-api:*@instance2*: # applies to only the foo-api tenant named "instance2"
  ...
```

## From the UI

Storing environment configuration in a file is handy for local development, but not ideal for production-grade credentials. In order to provide comparable, secure support for production secrets and values, Architect Cloud allows "Secrets" to be registered with each environment. Simply navigate to the "Secrets" tab on your environment to fill out the corresponding values:

![Secret Manager](./images/secret-manager-screenshot.png)

Once filled out, each deploy to the corresponding environment will be automatically enriched with matching values.

## Order of precedence

Since there are three different methods by which you can provide parameters, you may be wondering what happens if you used more than one. Architect interprets provided parameter values in the following order:

1. `--parameter` flag (highest priority)
2. `--secrets` flag
3. Environment secrets (lowest priority)
