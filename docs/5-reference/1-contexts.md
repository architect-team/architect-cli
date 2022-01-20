---
title: Contexts
---

# Expressions and Context

When writing [`architect.yml`](/docs/components/architect-yml) files, you can reference information about the runtime or environment, details that are otherwise unique to each deployed environment, through Architect's expression syntax. Encoding component's with these references can help limit the manual configuration needs of your services and make them portable from environment to environment.

## Available contexts

There are several context groups that contain important, dynamic information about your component and its future deployed environment. Below are the context categories available for reference:

| Context name                            | Description                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------ |
| [`dependencies`](#dependencies-context) | References to the dynamic outputs of each dependency and their interfaces      |
| [`ingresses`](#ingresses-context)       | References to the dynamic outputs of external interfaces                       |
| [`parameters`](#parameters-context)     | Dynamic values for the parameters declared by your component                   |
| [`services`](#services-context)         | References to the dynamic outputs of each service and their interfaces         |

### `dependencies` context

The `dependencies` context contains dynamic information about the dependencies of the component. This context can primarily be used to refer to the internal addresses of dependency interfaces.

| Property                                            | Type       | Description    |
| --------------------------------------------------- | ---------- | -------------- |
| `dependencies`                                      | `object`   | Information about the component's dependencies  |
| `dependencies.<dependency>`                         | `object`   | Information about the specified dependency      |
| `dependencies.<dependency>.interfaces`              | `object`   | Information about the dependency's interfaces   |
| `dependencies.<dependency>.interfaces.<interface>`  | `object`   | Information about the specified interface of the dependency. [See the interface values](#interface-values) for more details. |
| `dependencies.<dependency>.ingresses`               | `object`   | Information about the ingress rules associated with a dependency    |
| `dependencies.<dependency>.ingresses.<interface>`   | `object`   | Information about the specified ingress rule of the dependency. [See the interface values](#interface-values) for more details. |

### `ingresses` context

The `ingresses` context contains information about the external exposed interfaces.

| Property                                        | Type          | Description   |
| ----------------------------------------------- | ------------- | ------------- |
| `ingresses`                                     | `object`      | Information on the ingress rules of the component |
| `ingresses.<interface>`                         | `object`      | Information on an ingress rule matching the interface. [See the interface values](#interface-values) for more details. |

### `parameters` context

The `parameters` context contains all the values assigned to each parameter declared by your component.

| Property             | Type        | Description                                                    |
| -------------------- | ----------- | -------------------------------------------------------------- |
| `parameters`         | `object`    | A dictionary containing the parameter values                   |
| `parameters.<key>`   | `string`    | Resolves to the value of the specified parameter               |

### `services` context

The `services` context contains dynamic information about all the services inside the component. This context can primarily be used to refer to the interfaces of other services inside the component.

| Property                                    | Type        | Description |
| ------------------------------------------- | ----------- | ----------- |
| `services`                                  | `object`    | Information about each service inside the component |
| `services.<service>`                        | `object`    | Information specific to one of the named services inside the component |
| `services.<service>.interfaces`             | `object`    | Information about the specified service's interfaces |
| `services.<service>.interfaces.<interface>` | `object`    | Information about the specified service interface. [See the interface values](#interface-values) for more details. |

---

### `interface values`

Interface values are referenced in many places, `dependencies`, `ingresses`, `interfaces`, and `services` with a set of uniform values available to reference. These values include:

| Property     | Type      | Description                                                                                            |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------ |
| url   | The fully composed URL of the reference interface. This will take the format, `<protocol>://<username>:<password>@<host>:<port><path>`. |
| protocol | The protocol of the interface being referenced. This will always be the specific value assigned to the interface by the developer. |
| username | The username of the interface being referenced. Not all interfaces have usernames, so this will be an empty string if none is set. |
| password | The password of the interface being referenced. Not all interfaces have passwords, so this will be an empty string if none is set. |
| host  | The host value of the interface being referenced. This value is usually dynamic to accomodate the differences between service discovery solutions available to each environment. |
| port  | The port value of the interface being referenced. This will not always be the specific port that the interface is listening on as many container platforms leverage port mapping to ensure that there are no port collisions when sharing hardware in a cluster. |
| path  | The path value of the interface being referenced. Not all interfaces have paths, so this will be an empty string if none is set. |
