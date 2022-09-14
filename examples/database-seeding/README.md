<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# Database seeding example

This example shows how component creators can parameterize their components to allow for different database startup strategies, like automating migrations or database seeding. In a developer environment, it may be that we want to auto-run database migrations at application startup, while in production we may consider that to be dangerous. This is one of many examples of how an environment operator may wish to modify application behavior depending on the environment.

This example has been configured with a secret, `AUTO_DDL`, that dictates what strategy should be used to initialize the database, `none`, `migrate`, or `seed`. Whenever the component is run, we can optionally assign one of these values as the value for the secret.

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/database-seeding

# Deploy using the dev command
$ architect dev architect.yml -p AUTO_DDL=migrate
```

Once the deploy has completed, you can reach your new service by going to https://app.localhost.architect.sh/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect deploy architect.yml -e example-environment -p AUTO_DDL=migrate
```
