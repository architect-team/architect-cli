# Component Partial Unit Tests

- all files in this directory should be YML files that represent partial ComponentSpecs
- the directory structure should mirror the ComponentSpec structure, we dynamically load and merge these partials in automated tests
- a directory name is merged as a key inline with its parent partial
- a directory name that begins with _ is merged one level deep into its parent partial
- adding a partial component spec to this directory will analyze it with every other combination of merged ComponentSpecs
- no interpolation is performed here so interpolation strings are not being validated (for obvious reasons)
