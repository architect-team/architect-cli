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

# Register the component to the local registry
$ architect link .

# Deploy using the dev command
$ architect dev examples/stateful-component:latest -i frontend:frontend
```

Once the deploy has completed, you can reach your new service by going to http://frontend.arc.localhost/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! Just click the button below to deploy it to a sample Kubernetes cluster powered by Architect Cloud:

[![Deploy Button](https://docs.architect.io/deploy-button.svg)](https://cloud.architect.io/examples/components/stateful-component/deploy?tag=latest&interface=frontend%3Afrontend)

Alternatively, if you're already familiar with Architect and have your own environment registered, you can use the command below instead:

```sh
$ architect deploy examples/stateful-component:latest -a <account-name> -e <environment-name> -i frontend:frontend
```


