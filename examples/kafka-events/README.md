# kafka-demo

## Local deployment

### macOS

```sh
architect deploy -l arc.env.local.json
```

### Linux

Update the value of the environment variable `KAFKA_ADVERTISED_HOST_NAME` to `172.17.0.1` in arc.env.local.json.

```sh
architect deploy -l arc.env.local.json
```

## Remote deployment

```sh
architect deploy arc.env.dev.json
```
