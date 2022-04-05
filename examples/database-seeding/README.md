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

# Register the component to the local registry
$ architect link .

# Deploy using the dev command
$ architect dev examples/database-seeding:latest -i main:main -p AUTO_DDL=migrate
```

Once the deploy has completed, you can reach your new service by going to http://main.arc.localhost/.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! Just click the button below to deploy it to a sample Kubernetes cluster powered by Architect Cloud:

[![Deploy Button](https://docs.architect.io/deploy-button.svg)](https://cloud.architect.io/examples/components/database-seeding/deploy?tag=latest&interface=main%3Amain&secret=AUTO_DDL%3Dmigrate)

Alternatively, if you're already familiar with Architect and have your own environment registered, you can use the command below instead:

```sh
$ architect deploy examples/database-seeding:latest -a <account-name> -e <environment-name> -p AUTO_DDL=migrate
```
