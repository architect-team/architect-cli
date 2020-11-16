---
title: Introduction
symlinks:
  - /
  - /getting-started/
---

# Introduction

The [cloud-native landscape](https://landscape.cncf.io/) is full of powerful tools, but this landscape is constantly changing and the tools aren't designed for the every day developer. If developers hope to take advantage of modern design patterns, they need a framework designed for them instead of the endless landscape of operator-focused tools being forced upon them.

Architect is a self-service developer platform for cloud-native applications – enabling [continuous delivery](/docs/how-it-works/continuous-delivery), [service discovery](/docs/how-it-works/service-discovery), and [continuous security](/docs/how-it-works/continuous-security) all at once. We've taken inspiration from our experiences in big tech and at startups alike to create an simple, developer-focused framework that allows developers to build and extend cloud services like never before.

# First steps

The best way to learn how Architect works is through practice, and we've curated a simple set of steps you can follow to get you started:

1. [Install the CLI](#install-the-cli)
2. [Run a sample component](#run-a-sample-component)
3. [Make your own changes](#make-your-own-changes)
4. [Create a free Architect account](#create-a-free-architect-account)
5. [Register a component](#register-a-component)
6. [Deploy to the cloud](#deploy-to-the-cloud)

## Install the CLI

The best way to install the CLI is via NPM:

```bash
$ npm install -g @architect-io/cli
```

Alternatively, you can download the binary for your system architecture from [Github](https://github.com/architect-team/architect-cli/releases/latest). Just download the appropriate bundle, extract it, and link the included `bin` folder to your user home directory.

## Run a sample component

![react-demo-screenshot](/images/docs/getting-started/introduction/react-demo.png)

```sh
$ git clone https://github.com/architect-team/architect-cli.git
$ architect link ./examples/react-demo
$ architect deploy --local examples/react-demo:latest -i app:frontend
```

## Make your own changes

## Create a free Architect account

## Register a component

```sh
$ architect register ./examples/react-demo/ --tag latest
```

## Deploy to the cloud

```sh
$ architect deploy examples/react-demo:latest \
    --account <account-name> \
    --environment example-env \
    -i app:frontend
```
