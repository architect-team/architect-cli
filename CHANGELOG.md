# [1.23.0](https://github.com/architect-team/architect-cli/compare/v1.22.1...v1.23.0) (2022-08-15)


### Bug Fixes

* **cli:** Switch from postinstall to prepare ([ffac972](https://github.com/architect-team/architect-cli/commit/ffac972ec4ab75e596ffe4154e03f87a6139c34a))
* **dev:** Don't show ping access logs unless they fail ([33dc9b4](https://github.com/architect-team/architect-cli/commit/33dc9b4d038ca06234b0641a5fc0fc69878f54cd))
* **dev:** Make `architect dev` more robust ([#661](https://github.com/architect-team/architect-cli/issues/661)) ([eda1cff](https://github.com/architect-team/architect-cli/commit/eda1cffe3bce6344929724d2daec64d34d58b1cc))
* **exec:** Fix issue with commands run in no-tty but with stdin available exiting prematurely due to stdin closing ([#656](https://github.com/architect-team/architect-cli/issues/656)) ([06ef0df](https://github.com/architect-team/architect-cli/commit/06ef0df0cf49fd11c0139fae57003a4f087f7cf6))
* **exec:** no local selection when docker is unavailable ([#662](https://github.com/architect-team/architect-cli/issues/662)) ([e3bf33b](https://github.com/architect-team/architect-cli/commit/e3bf33b1a47c23c1dae17c6fc492e687297209e9))
* **register:** Allow register without build ([#660](https://github.com/architect-team/architect-cli/issues/660)) ([033f261](https://github.com/architect-team/architect-cli/commit/033f2612f83439f0c30cee8f770b577d0b0de5d1))


### Features

* **link:** 473 list linked components ([#658](https://github.com/architect-team/architect-cli/issues/658)) ([b40c347](https://github.com/architect-team/architect-cli/commit/b40c347e4a3f14e61428271811ad5af87ff19a56))

## [1.22.1](https://github.com/architect-team/architect-cli/compare/v1.22.0...v1.22.1) (2022-08-05)


### Bug Fixes

* **exec:** Automatically detect proper value for flags.tty if not explicitly set ([#651](https://github.com/architect-team/architect-cli/issues/651)) ([9b3de88](https://github.com/architect-team/architect-cli/commit/9b3de8885b935b4f3fd81be271a18983e6c8a2c9))
* **exec:** exit with remote exec error codes ([#652](https://github.com/architect-team/architect-cli/issues/652)) ([d2f2df4](https://github.com/architect-team/architect-cli/commit/d2f2df471185d61e6b916e061cab7885c888c39b))

# [1.22.0](https://github.com/architect-team/architect-cli/compare/v1.21.1...v1.22.0) (2022-08-04)


### Bug Fixes

* **dev:** Add ARC_DEV env for detecting if we are running locally ([85bc88c](https://github.com/architect-team/architect-cli/commit/85bc88cf32047643a8871b9b47caac80ba9ef870))
* **docs:** fix links to docs by making them absolute ([74ba274](https://github.com/architect-team/architect-cli/commit/74ba274e137878e47cf373bd72e7a300590e2d89))
* **exec:** Pass the proper auth header when using exec via token_type ([#646](https://github.com/architect-team/architect-cli/issues/646)) ([54861dc](https://github.com/architect-team/architect-cli/commit/54861dcfb181fd32347f5313d5406b129e8b7dab))
* **init:** debug block instead of interpolation ([#647](https://github.com/architect-team/architect-cli/issues/647)) ([22e811c](https://github.com/architect-team/architect-cli/commit/22e811c6960889505bcf5071e8f9c5ba6e50fe8d))
* **sentry:** Sentry Refactor and Bug Fix ([#648](https://github.com/architect-team/architect-cli/issues/648)) ([598034b](https://github.com/architect-team/architect-cli/commit/598034bf79cb918308eb2048a615b0cf0904853b))


### Features

* **deploy:** Ephemeral component versions ([#642](https://github.com/architect-team/architect-cli/issues/642)) ([6d90449](https://github.com/architect-team/architect-cli/commit/6d904493fd5299413ad3c3906a5b0bad3df874a8))
* **spec:** support circular dependencies ([#641](https://github.com/architect-team/architect-cli/issues/641)) ([86835ca](https://github.com/architect-team/architect-cli/commit/86835ca1c8af9b3df1bef0eded1e826a11c932e2))

## [1.21.1](https://github.com/architect-team/architect-cli/compare/v1.21.0...v1.21.1) (2022-07-22)


### Bug Fixes

* **dev:** Fix debug with dependencies ([46ffa85](https://github.com/architect-team/architect-cli/commit/46ffa8555deabb202444768fab5a28e1d292e4b5))
* **exec:** Add status code on exit for exec local ([#636](https://github.com/architect-team/architect-cli/issues/636)) ([00dd0e2](https://github.com/architect-team/architect-cli/commit/00dd0e27d0fc393871fd301a72448ac45ff99a01))
* **package:** pin class-transformer to 0.4.0 ([049217f](https://github.com/architect-team/architect-cli/commit/049217fc1013a270c7cedc2fe9a09f1c6694b7e5))

# [1.21.0](https://github.com/architect-team/architect-cli/compare/v1.20.1...v1.21.0) (2022-07-21)


### Bug Fixes

* **build:** Add github action to test build/run of cli ([#632](https://github.com/architect-team/architect-cli/issues/632)) ([936c905](https://github.com/architect-team/architect-cli/commit/936c90560fc41aeae71ddab7f18ad5cc05dd92d8))


### Features

* **register:** Add support for gha caching ([9ef4063](https://github.com/architect-team/architect-cli/commit/9ef4063f4a86fb6d9beb731a2350d6784d80394a))

## [1.20.1](https://github.com/architect-team/architect-cli/compare/v1.20.0...v1.20.1) (2022-07-20)


### Bug Fixes

* **cli:** remove chai ref in doctor cmd ([569b2fe](https://github.com/architect-team/architect-cli/commit/569b2fefd21a4f0e990db197f77e85ed44c4667b))

# [1.20.0](https://github.com/architect-team/architect-cli/compare/v1.19.2...v1.20.0) (2022-07-20)


### Bug Fixes

* **examples:** liveness probe update ([#629](https://github.com/architect-team/architect-cli/issues/629)) ([1d94780](https://github.com/architect-team/architect-cli/commit/1d947802fc21dd877f59128960e39571f474d4d8))
* **exec:** local exec didn't work with multiple cmd args ([fb5ec5b](https://github.com/architect-team/architect-cli/commit/fb5ec5bce5583f1bfa52870527abfc75adc26392))
* **platform:** Better user authentication support for Kubernetes clusters ([0bb49d0](https://github.com/architect-team/architect-cli/commit/0bb49d05369381efcd74dfb38ac82fe3522df0f4))
* **volumes:** don't allow for host_path to be specified outside of a debug block ([b9e0b19](https://github.com/architect-team/architect-cli/commit/b9e0b1995dbee32d3916cb46220f7606936bfb7c))


### Features

* **doctor:** Add a doctor command that outputs additional information for debugging ([8abe76d](https://github.com/architect-team/architect-cli/commit/8abe76de0932fd50e88ab67b3ca5bf35979c48e2))

## [1.19.2](https://github.com/architect-team/architect-cli/compare/v1.19.1...v1.19.2) (2022-07-18)


### Bug Fixes

* **build:** Fix bug with buildx context ([#626](https://github.com/architect-team/architect-cli/issues/626)) ([892024c](https://github.com/architect-team/architect-cli/commit/892024c42cb9110d6dd0b75f6c94fe06dcc21b45))
* **debug:** 453 debug block ([#625](https://github.com/architect-team/architect-cli/issues/625)) ([1e449a7](https://github.com/architect-team/architect-cli/commit/1e449a75bbfa70b6736e3ee626eb16c6cf35ddf0))
* **interpolation:** Register interpolation validation ([#580](https://github.com/architect-team/architect-cli/issues/580)) ([df1c943](https://github.com/architect-team/architect-cli/commit/df1c9433173da0da3d5b110e572ffb367358d7fd))

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
