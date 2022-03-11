<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# React JS example

An extremely common, modern application stack includes three services: a frontend webapp, a server-side API, and a database. In this example, you'll learn how that stack can be captured in an Architect component to enable automated deployments, networking, and network security for your application wherever it gets deployed to.

In the `architect.yml` file for this project, we describe all three of these services as deployable runtimes. However, we also leverage Architect's [service discovery](//docs.architect.io/components/service-discovery) features to populate environment parameters by reference. This not only allows us to automatically connect the services to each other, but it also allows Architect to build strict network policies to whitelist the traffic between these services. Now we won't have any work ahead of us to promote this stack from local dev all the way through to production readiness!

[Learn more about the architect.yml file](//docs.architect.io/configuration)

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/react-app

# Register the component to the local registry
$ architect link .

# Deploy using the dev command
$ architect dev examples/react-app:latest -i app:app
```

Once the deploy has completed, you can reach your new service by going to http://app.arc.localhost/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! Just click the button below to deploy it to a sample Kubernetes cluster powered by Architect Cloud:

[![Deploy Button](https://docs.architect.io/deploy-button.svg)](https://cloud.architect.io/examples/components/react-app/deploy?tag=latest&interface=app%3Aapp)

Alternatively, if you're already familiar with Architect and have your own environment registered, you can use the command below instead:

```sh
$ architect deploy examples/react-app:latest -a <account-name> -e <environment-name> -i app:app
```

## Advanced deployment example

See [this readme](https://github.com/architect-team/architect-cli/blob/master/examples/react-app/github/README.md) for an advanced configuration and deployment example which includes steps to create your own AWS infrastructure all the way to automated deployments using Architect.
