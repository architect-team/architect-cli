## [1.19.1](https://github.com/architect-team/architect-cli/compare/v1.19.0...v1.19.1) (2022-07-13)


### Bug Fixes

* **liveness:** Update liveness probe to better emulate kubernetes locally. ([33a4184](https://github.com/architect-team/architect-cli/commit/33a4184823592c988aff01aff2462d17f0f01b4e))

# [1.19.0](https://github.com/architect-team/architect-cli/compare/v1.18.2...v1.19.0) (2022-07-12)


### Bug Fixes

* **analytics:** Fixed crash when docker context could not be found ([0a652ed](https://github.com/architect-team/architect-cli/commit/0a652ed06ff3b4c7b0a3c903fcec155ae7d2159d))
* **register:** Improve cache mechanism when registering components  ([1289b7c](https://github.com/architect-team/architect-cli/commit/1289b7cf0888a267afcc10f03f3241de27e2377e))


### Features

* **analytics:** Improve analytics on error ([98cdb62](https://github.com/architect-team/architect-cli/commit/98cdb620af78d5cc31fff16debd89cead034fabc))

## [1.18.2](https://github.com/architect-team/architect-cli/compare/v1.18.1...v1.18.2) (2022-07-08)


### Bug Fixes

* **analytics:** fix issue with sentry ([be24cb4](https://github.com/architect-team/architect-cli/commit/be24cb416b4b1087cb699adc71ed65d91c1c4130))

## [1.18.1](https://github.com/architect-team/architect-cli/compare/v1.18.0...v1.18.1) (2022-07-08)


### Performance Improvements

* **register:** Improve caching for multi-stage builds ([7d354e5](https://github.com/architect-team/architect-cli/commit/7d354e586041e4910b7c949991a73eb19c9c1438))

# [1.18.0](https://github.com/architect-team/architect-cli/compare/v1.17.2...v1.18.0) (2022-07-08)


### Bug Fixes

* **context:** including error if context doesn't exist and test updates ([#589](https://github.com/architect-team/architect-cli/issues/589)) ([adf6f88](https://github.com/architect-team/architect-cli/commit/adf6f887918e274e22ed7c4ad392d8606a493957))
* **interpolation:** fixing interpolation if a service config string has a -- in it ([#610](https://github.com/architect-team/architect-cli/issues/610)) ([7fc8458](https://github.com/architect-team/architect-cli/commit/7fc84586663869a622cc610e1d90dc2631abbdd6))
* **k8s:** Support k8s 1.24+ ([#608](https://github.com/architect-team/architect-cli/issues/608)) ([cfed071](https://github.com/architect-team/architect-cli/commit/cfed07182410ad311884b005ca39765794bf41a6))


### Features

* **error:** Add sentry error logging ([603ea01](https://github.com/architect-team/architect-cli/commit/603ea0176cb507ee754c1b7cb53b69c83cbfcd43))
* **platform:** Warn user about unsupported version of Kubernetes. ([3f6b702](https://github.com/architect-team/architect-cli/commit/3f6b7023a1aebfccc5b1901e8ade2d3fae83e23b))
* **register:** Specify which architectures to build for your containers ([f5f81de](https://github.com/architect-team/architect-cli/commit/f5f81de7aa360273e2c57211fc52aa2983f964a2))
* **secrets:** Can upload and download secrets to accounts an environments. ([0d17b77](https://github.com/architect-team/architect-cli/commit/0d17b77d65635c2b0973959bc91d9618269e1bbc))

## [1.17.2](https://github.com/architect-team/architect-cli/compare/v1.17.1...v1.17.2) (2022-06-23)


### Bug Fixes

* **publish:** Clean before publishing ([#605](https://github.com/architect-team/architect-cli/issues/605)) ([e6c6aae](https://github.com/architect-team/architect-cli/commit/e6c6aae299e18478e37b05f8ee0f0fce622b455f))

## [1.17.1](https://github.com/architect-team/architect-cli/compare/v1.17.0...v1.17.1) (2022-06-23)


### Bug Fixes

* **error:** safeguard adding more error context ([afa04f3](https://github.com/architect-team/architect-cli/commit/afa04f38541486e075c942634ad41dd3a1f73a35))

# [1.17.0](https://github.com/architect-team/architect-cli/compare/v1.16.4...v1.17.0) (2022-06-23)


### Bug Fixes

* **interpolation:** Whitelist interpolation ([#577](https://github.com/architect-team/architect-cli/issues/577)) ([792de39](https://github.com/architect-team/architect-cli/commit/792de39b9904c75cbc0b02c650611e98cfc1b340))
* **ref:** Behind the scenes support for better name handling ([d96008f](https://github.com/architect-team/architect-cli/commit/d96008f76aa7ca077eac8fa519d84e4ed886e0b3))
* **register:** Switch to buildx for building containers ([539e189](https://github.com/architect-team/architect-cli/commit/539e189a2f4a470b91101084409abed0f5a57703))


### Features

* **reserved names:** Adding architect_ref for image name generation and tagging ([d5e4c51](https://github.com/architect-team/architect-cli/commit/d5e4c518f875c06dbe3eb4f35dd6d6effc060da4))
* **reserved_name:** Adding reserved names ([#564](https://github.com/architect-team/architect-cli/issues/564)) ([0058d3d](https://github.com/architect-team/architect-cli/commit/0058d3d526f6d2044e044a26d546eed8cc90057f))

## [1.16.4](https://github.com/architect-team/architect-cli/compare/v1.16.3...v1.16.4) (2022-05-17)


### Bug Fixes

* **register:** Reverted buildx changes as we investigate issues with CI providers. ([a0b17d4](https://github.com/architect-team/architect-cli/commit/a0b17d479bbcb47d1852b27f6af05395496cf03b))

## [1.16.3](https://github.com/architect-team/architect-cli/compare/v1.16.2...v1.16.3) (2022-05-12)


### Bug Fixes

* **register:** Improved support for M1 builds. ([7f6b672](https://github.com/architect-team/architect-cli/commit/7f6b672089c290bf4d12c984b4cbf443b4b4849d))

## [1.15.2](https://github.com/architect-team/architect-cli/compare/v1.15.1...v1.15.2) (2022-04-12)


### Bug Fixes

* **register:** ignore conditional services for register and validate docker-compose ([af2b02b](https://github.com/architect-team/architect-cli/commit/af2b02bf1488409ddf260a659619b6e1b3d330ec))
* **register:** ignore conditional services for register and validate docker-compose ([87e44f9](https://github.com/architect-team/architect-cli/commit/87e44f9b3153de5514c0f783ce9115737c0d6c82))
