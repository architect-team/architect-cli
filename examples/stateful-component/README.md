<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# Stateful Architect components

Almost all microservices or backend stacks require a database or some for of state in order to persist important user or session data. In this example, you'll see how you can describe an `architect.yml` file that includes a frontend webapp, a backend API, and of course a database allocated privately for said API.

[Learn more about the architect.yml file](//docs.architect.io/configuration)

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/stateful-component

# Deploy using the dev command
$ architect dev ./architect.yml
```

Once the deploy has completed, you can reach your new service by going to https://frontend.localhost.architect.sh/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect deploy ./architect.yml -e <environment-name>
```
