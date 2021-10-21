---
title: Multi-Tenant Deployments
---

# Multi-Tenant Deployments

Multi-tenant deployments are when

By default, deploying a component will create it as a singleton in the environment, where it is the default instance.

In some cases you may want to deploy multiple instances of a component to an environment. The deployment process creates a global tenant by default, but you can create a named tenant simply by naming the component being deployed. This is called a "multi-tenant deployment".

```
architect-local deploy examples/react-app@app1
```

This process works for updating existing deployments as well. If an "app1" tenant of the `examples/react-app` component had already been deployed, the above command would have deployed to that same tenant, leaving any other instances of the component untouched.

## Deployments and Management Lifecycle

When you view your deployed components, you'll see that the react-app has the name "app1" whereas the typical deployment without a tenant name will show only the component. In this example we've deployed the example React App twice with the tenant names "app1" and "app2", and once without a tenant name.

![multi-tenant](./images/multi-tenant-components.png)

## Secrets and Values

Configuring individual tenants works the same way as deploying those tenants: by providing the tenant name. Secrets use the component scopes to specify which values will be applied to which components, so setting a secret for a tenant is as simple as providing the tenant name in the component scope.

In the case of the example React App, the following will override the `world_text` parameter for just the `sandiego` tenant.

```yaml
'examples/react-app@sandiego':
  world_text: San Diego
```

This enables minimal dupliation of configuration, as you can specify any necessary values in a generic component scope, but then override specific values on a tenant-by-tenant basis. In the following example, the `planetearth` tenant would have the `foo` parameter as configured in the first scope, but would have the overwritten values for `world_text` set in the second scope.

```yaml
'examples/react-app':
  foo: bar
  world_text: world!
'examples/react-app@planetearth':
  world_text: Planet Earth
```
