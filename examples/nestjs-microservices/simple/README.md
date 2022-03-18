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

## Setup

This project uses [Architect](https://architect.io) to deploy and manage our two services simultaneously. Install Architect's CLI to deploy both services:

```bash
$ npm install -g @architect-io/cli
```

Architect uses [Components](https://docs.architect.io) to encapsulate servcices allowing them to be deployed and extended. Both our TCP server and HTTP client have component manifest files describing them (`architect.yml` files) so that they can be automatically deployed.

Normally component's would be sourced from Architect's cloud registry, but when developing our components we want them to be run directly from the source. Fortunately, Architect simulates the registry locally by allowing components to be [linked](https://www.architect.io/docs/guides/developing-multiple-components#component-linking) to the local file system. Linking components tells Architect's CLI that the components already exist and don't need to be pulled from the registry.

```bash
$ cd ./simple
$ architect link .
Successfully linked examples/nestjs-simple to local system at /architect-cli/examples/nestjs-microservices/simple

$ architect link ./client/
Successfully linked examples/nestjs-simple-client to local system at /architect-cli/examples/nestjs-microservices/simple/client
```

## Running locally

The REST client service cites the TCP server as a dependency. This means that Architect can automatically deploy and connect to it whenever the client is deployed, and all we have to do is deploy the client component:

```bash
$ architect dev examples/nestjs-simple-client:latest -i main:client
```

Once the application is done booting, the REST client will be available on http://app.arc.localhost/hello/Name

## Deploying to the cloud

Want to try deploying this to a cloud environment? Architect's got you covered there too! Just click the button below to deploy it to a sample Kubernetes cluster powered by Architect Cloud:

[![Deploy Button](https://docs.architect.io/deploy-button.svg)](https://cloud.architect.io/examples/components/nestjs-simple-client/deploy?tag=latest&interface=main%3Aclient)

Alternatively, if you're already familiar with Architect and have your own environment registered, you can use the command below instead:

```sh
$ architect deploy examples/nestjs-simple-client:latest -a <account-name> -e <environment-name>
```
