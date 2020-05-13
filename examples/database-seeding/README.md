## Example Application: Database Seeding Through Parameter Configuration

### Quickstart

##### For a 'dev' environment:
In the arc.env.yml, set `AUTO_DDL:migrate`
```
architect deploy -l arc.env.yml
```
At http://api.localhost:3000/users, you should see an empty list of users because the AUTO_DDL parameter is set to 'migrate' which migrated the schema from the Typeorm schema migration scripts in src/migrations.

##### For a 'qa' environment:
In thje arc.env.yml, set `AUTO_DDL:seed`
```
architect deploy -l arc.env.yml
```
At http://api.localhost:3000/users, you should see a list of test users generated because the AUTO_DDL parameter is set to 'seed' which migrated the schema and ran the populated the test fixtures from src/fixtures.


### Example Explained

This example shows how we may use a service parameter to configure different database startup strategies.

In a developer environment, it may be that we want to auto-run database migrations at application startup, while in production we may consider that to be dangerous. This is one of many examples of how an environment operator may wish to modify application behavior depending on the environment. Architect provides a straightforward approach to such configuration:

(1) The service developer declares a parameter in the `architect.yml` file:

```
name: examples/database-seeding
// ...
parameters:
  // ...
  AUTO_DDL:
    description: Options are 'none', 'migrate', and 'seed'; none- no ddl; migrate- runs unrun database migrations at application start; seed- runs unrun migrations and test data seeding script at application start
    default: none
// ...
```

(2) Under the hood, the developer can make use of the value of that parameter by grabbing it from its environment variable:
```
    const auto_ddl = process.env.AUTO_DDL;

    if (auto_ddl === 'migrate') {
      await this.runMigrations();
    } else if (auto_ddl === 'seed') {
      await this.runMigrations();
      await this.seeDatabase();
    } else if (auto_ddl === 'none') {
      // do nothing...
    } else {
    // ...
  }
```

(3) The environment operator then has the chance to set the parameter value in the `arc.env.yml` file.

At runtime, a developer might configure their local environment like this so migrations run at startup...
```
services:
  examples/database-seeding:latest:
    // ...
    parameters:
      AUTO_DDL: migrate
```

...whereas a production operator may prefer to configure the environment to run without any migrations...
```
services:
  examples/database-seeding:latest:
    // ...
    parameters:
      AUTO_DDL: none
```

And the quality assurance organization may prefer to start the application up with seed data...
```
services:
  examples/database-seeding:latest:
    // ...
    parameters:
      AUTO_DDL: seed
```

### Notes

* This example uses [Typeorm](https://typeorm.io/#/) to manage the database migrations. See docs here: https://github.com/typeorm/typeorm/blob/master/docs/migrations.md
* You can see the fixture data that `AUTO_DDL:seed` adds here: `./src/fixtures/`.
* You can see the migration scripts that `AUTO_DDL:migrate` runs here: `./src/fixtures/`.

## Recap

Environment-specific database manipulation presents a common problem for developing applications in a truly portable way. Architect's parameter construct provides a clean channel to communicate this information between service developers and service operators.

Questions? Don't hesitate to reach out to the architect team!
