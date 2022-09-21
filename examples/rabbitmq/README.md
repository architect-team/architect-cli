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

# RabbitMQ

This example RabbitMQ project will start up a message producer and a message consumer as well as [RabbitMQ](https://www.rabbitmq.com/) to facilitate communication between services. Messages will be passed from the producer, to a RabbitMQ queue, then finally to the consumer on a regular cadence.

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/rabbitmq

# Deploy using the dev command
$ architect dev ./architect.yml
```

Once the deploy has completed, you can view the RabbitMQ dashboard at https://admin.localhost.architect.sh/ and log in with username `guest` and password `guest`. Use the sample app at https://app.localhost.architect.sh/ to push messages from the message producer to the queue.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect deploy ./architect.yml -e example-environment
```
