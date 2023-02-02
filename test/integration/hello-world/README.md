<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.architect.io/logo/horizontal-inverted.png">
    <source media="(prefers-color-scheme: light)" srcset="https://cdn.architect.io/logo/horizontal.png">
    <img width="320" alt="Architect Logo" src="https://cdn.architect.io/logo/horizontal.png">
  </picture>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# Hello world w/ Architect

This example will show you the leanest possible use-case for Architect – "Hello world"! In this example, we've written a component spec (the `architect.yml` file) that defines a component powered our own Docker image. From there it goes on to annotate the ports the service listens on and the interfaces that should be exposed to upstream callers.

[Learn more about the architect.yml file](//docs.architect.io/configuration)

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone git@github.com:architect-community/hello-world.git
$ cd ./hello-world

# Deploy using the dev command
$ architect dev ./architect.yml
```

Once the deploy has completed, you can reach your new service by going to https://hello.localhost.architect.sh/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect deploy ./architect.yml -e example-environment
```
