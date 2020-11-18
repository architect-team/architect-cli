---
title: Continuous delivery
---

# Continuous Delivery

Architect's framework and cloud platform were designed to allow developers to quickly and easily deploy their software to any environment.

## No references to platforms or tools

Architects framework is intended to allow services to be deployed to any cloud provider. In order to accoplish this, the framework was intentionally designed to focus on features of the application instead of features of the target infrastructure. The framework abstracts away the details of the deploy targets - container platforms, networking tools, and more - to make it easier for developers to deploy and to give operators the flexibility to deploy to environments with their own tools and preferences.

## Deploy-time transformation

Of course at some point we need to be able to transform component configurations in order to prepare them to be deployed, but this transformation is automated by our framework. Components configurations intentionally exclude these infrastructure details, and instead these details are encoded with the environments. Whenever a component is deployed to an environment, Architect will transform the service definitions to a suitable format for that target (e.g. Deployments for Kubernetes or task definitions for AWS ECS). By performing this transformation at deploy time, we're able to maintain portability across tools and providers.

## Infrastructure-as-Code (IaC)

Some information about infrastructure as code.

Some details about how Architect components are utilized like infrastructure as code templates.

## Deploying related services

As much as we might want them to, services don't live in a vacuum. Even simple API services often rely on a database or state. Architect captures related services and deploys them together.

## Resolving dependencies

Distributed teams require dependency management
