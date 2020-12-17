Architect dependency-manager
=============

Library used for ingesting component specs and converting them to application graphs.

## Generating and using json schema

This project uses the [JSON schema](https://json-schema.org/) spec to help validate `architect.yml` files describing components. In order to make this schema easier to manage, we use the [typescript-json-schema]() library to generate the schema definition from a typescript interface.

After you've made changes to the typescript files representing the schema(s), run the associated generate:schema command:

```sh
$ npm run generate:schema:v1
```

This will write the schema file to `./v1-component-schema.json`.

### Testing the schema in VS Code

The first thing you'll need to do is install [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) for VS Code. This is needed to allow your editor to respond to json schema templates found locally or in the json schema store, a public repository of json schemas associated with filenames.

Once you have the extension installed, ppen your [VS Code settings.json file](https://code.visualstudio.com/docs/getstarted/settings#_settings-file-locations) and associate the generated schema file with the `architect.yml` and `architect.yaml` file types:

```json
{
  "yaml.schemas": {
    "<path-to-cli>/src/dependency-manager/v1-component-schema.json": ["architect.yaml", "architect.yml"]
  }
}
```

_Be sure to replace `<path-to-cli>` with the directory where you checked out the Architect CLI project._

### Publishing schema to public store

Unfortunately this can't be automated. You'll have to submit a PR to the repository and follow the contributing guidelines:

https://github.com/SchemaStore/schemastore/blob/master/CONTRIBUTING.md
