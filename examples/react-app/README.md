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

# React JS example

An extremely common, modern application stack includes three services: a frontend webapp, a server-side API, and a database. In this example, you'll learn how that stack can be captured in an Architect component to enable automated deployments, networking, and network security for your application wherever it gets deployed to.

In the `architect.yml` file for this project, we describe all three of these services as deployable runtimes. However, we also leverage Architect's [service discovery](//docs.architect.io/components/service-discovery) features to populate environment secrets by reference. This not only allows us to automatically connect the services to each other, but it also allows Architect to build strict network policies to whitelist the traffic between these services. Now we won't have any work ahead of us to promote this stack from local dev all the way through to production readiness!

[Learn more about the architect.yml file](//docs.architect.io/configuration)

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/react-app

# Deploy using the dev command
$ architect dev ./architect.yml
```

Once the deploy has completed, you can reach your new service by going to https://app.localhost.architect.sh/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect deploy ./architect.yml -e example-environment
```

## Advanced deployment example

See [this readme](https://github.com/architect-team/architect-cli/blob/master/examples/react-app/github/README.md) for an advanced configuration and deployment example which includes steps to create your own AWS infrastructure all the way to automated deployments using Architect.
