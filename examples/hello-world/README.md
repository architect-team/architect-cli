<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
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
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/hello-world

# Register the component to the local registry
$ architect link .

# Deploy using the dev command
$ architect dev hello-world:latest
```

Once the deploy has completed, you can reach your new service by going to http://hello.arc.localhost/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! Just click the button below to deploy it to a sample Kubernetes cluster powered by Architect Cloud:

[![Deploy Button](https://docs.architect.io/deploy-button.svg)](https://cloud.architect.io/examples/components/hello-world/deploy?tag=latest&interface=hello%3Ahello)

Alternatively, if you're already familiar with Architect and have your own environment registered, you can use the command below instead:

```sh
$ architect deploy hello-world:latest -a <account-name> -e <environment-name>
```


