<p align="center">
  <a href="//architect.io" target="blank"><img src="https://docs.architect.io/img/logo.svg" width="320" alt="Architect Logo" /></a>
</p>

<p align="center">
  A dynamic microservices framework for building, connecting, and deploying cloud-native applications.
</p>

---

# NestJS TCP microservices

Nest (NestJS) is a framework for building efficient, scalable Node.js server-side applications. It uses progressive JavaScript, is built with and fully supports TypeScript (yet still enables developers to code in pure JavaScript) and combines elements of OOP (Object Oriented Programming), FP (Functional Programming), and FRP (Functional Reactive Programming).

In addition to traditional (sometimes called monolithic) application architectures, Nest natively supports the microservice architectural style of development. Wherever possible, Nest abstracts implementation details so that the same components can run across HTTP-based platforms, WebSockets, and Microservices.

This repository contains the source code for two NestJS microservices: one that uses Nest's native microservices utilities to create a TCP-based microservice, and another that uses the default Nest framework to expose a REST API that proxies to the TCP service.

## Running locally

Architect component specs are declarative, so it can be run locally or remotely with a single deploy command:

```sh
# Clone the repository and navigate to this directory
$ git clone https://github.com/architect-team/architect-cli.git
$ cd ./architect-cli/examples/nestjs-microservices/simple

# Register the dependent components to the local registry
$ architect link ./architect.yml

# Deploy using the dev command
$ architect dev ./client/architect.yml
```

Once the deploy has completed, you can reach your new service by going to https://app.localhost.architect.sh/hello/Name.

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! if you've already [created your account](https://cloud.architect.io/signup), you can run the command below to deploy the component to a sample Kubernetes cluster powered by Architect Cloud:

```sh
$ architect register ./architect.yml

$ architect deploy ./client/architect.yml -e <environment-name>
```
