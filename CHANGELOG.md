# [1.36.0](https://github.com/architect-team/architect-cli/compare/v1.35.0...v1.36.0) (2023-03-21)


### Bug Fixes

* **databases:** Databases redacted secrets ([#855](https://github.com/architect-team/architect-cli/issues/855)) ([541e07e](https://github.com/architect-team/architect-cli/commit/541e07eed00abe9427342bf515eeefcdcf20f870))
* **depends_on:** Use expanded depends_on syntax for service health ([#862](https://github.com/architect-team/architect-cli/issues/862)) ([9bc61ca](https://github.com/architect-team/architect-cli/commit/9bc61ca44e452f76d2cdca7ac1fe830b6f3b0434))
* **init:** Add starter flag to init command ([#858](https://github.com/architect-team/architect-cli/issues/858)) ([8b9a564](https://github.com/architect-team/architect-cli/commit/8b9a564b248ff1b6ecd18c5b5f0ed2f15298f64e))
* **init:** Fix init flow ([#861](https://github.com/architect-team/architect-cli/issues/861)) ([670738e](https://github.com/architect-team/architect-cli/commit/670738e442f9ed1431d30da4ccca327f03c282e0))
* **prompt:** Shortcut prompt for cluster/environment if only one instance exists ([#859](https://github.com/architect-team/architect-cli/issues/859)) ([d664280](https://github.com/architect-team/architect-cli/commit/d66428064ba260bd47c4a55b288f234102ba9e7c))
* **register:** Disable provenance to fix issues with image pulling in k8s clusters ([#860](https://github.com/architect-team/architect-cli/issues/860)) ([7b3580b](https://github.com/architect-team/architect-cli/commit/7b3580b6b4744eac120f8ae6db9c9ca08e360e4c))


### Features

* **dev:** Automatically clean up local docker cache for unused images ([291eeec](https://github.com/architect-team/architect-cli/commit/291eeec5d99ffa2155c94aad88447bc1422ac15a))
* **port-forward:** Add port-forward command ([#854](https://github.com/architect-team/architect-cli/issues/854)) ([8bab709](https://github.com/architect-team/architect-cli/commit/8bab7090b0b971b79159af03e39d05dfede0a68f))


### Reverts

* Revert "feat(dev): Automatically clean up local docker cache for unused images" (#856) ([686ccfb](https://github.com/architect-team/architect-cli/commit/686ccfb5d628aeb53deb7e4e6997bed94ade2117)), closes [#856](https://github.com/architect-team/architect-cli/issues/856)

# [1.35.0](https://github.com/architect-team/architect-cli/compare/v1.34.0...v1.35.0) (2023-03-10)


### Bug Fixes

* **dev:** Add additional check that service IP exists so services with liveness probes arent presumed healthy too early ([#852](https://github.com/architect-team/architect-cli/issues/852)) ([070a8c2](https://github.com/architect-team/architect-cli/commit/070a8c2a48c7b81a3ff73fef01f2b69a54fc0a0a))
* **type:** Add missing fields to DependencyState ([a4b7a4d](https://github.com/architect-team/architect-cli/commit/a4b7a4d4664faa7d8d236aa0178d22a5534336f7))


### Features

* **spec:** Added support for declared databases that become services ([#790](https://github.com/architect-team/architect-cli/issues/790)) ([a0b3275](https://github.com/architect-team/architect-cli/commit/a0b327583510634adcba3ba7607184a5881ca6b0)), closes [#846](https://github.com/architect-team/architect-cli/issues/846) [#846](https://github.com/architect-team/architect-cli/issues/846) [#847](https://github.com/architect-team/architect-cli/issues/847) [#847](https://github.com/architect-team/architect-cli/issues/847) [#848](https://github.com/architect-team/architect-cli/issues/848) [#848](https://github.com/architect-team/architect-cli/issues/848) [#849](https://github.com/architect-team/architect-cli/issues/849) [#849](https://github.com/architect-team/architect-cli/issues/849)

# [1.34.0](https://github.com/architect-team/architect-cli/compare/v1.33.2...v1.34.0) (2023-03-07)


### Bug Fixes

* **cluster:create:** Make sure a cluster name is unique before creation ([#840](https://github.com/architect-team/architect-cli/issues/840)) ([27d14f7](https://github.com/architect-team/architect-cli/commit/27d14f7a4b93dc22f21e3e16f1762f80f7d2f261))
* **deploy:** Add missing flags from register to deploy ([#849](https://github.com/architect-team/architect-cli/issues/849)) ([61c3349](https://github.com/architect-team/architect-cli/commit/61c33496f3502a2a9918aeec5229a72b2a5e23cc))
* **dev:restart:** Default --build to true ([#847](https://github.com/architect-team/architect-cli/issues/847)) ([dbf8cc0](https://github.com/architect-team/architect-cli/commit/dbf8cc000aabfe00145208924fee8ad220acce4c))
* **dev:** Update description of environment flag to emphasize it is for local use only ([e9a66c4](https://github.com/architect-team/architect-cli/commit/e9a66c4ae7b1c4c2f023c7ac0f7a93180d84a5c6))
* **init:** Depends on now supports dictionaries ([#848](https://github.com/architect-team/architect-cli/issues/848)) ([30fedca](https://github.com/architect-team/architect-cli/commit/30fedca35dbcdc5b4bf42847c8792d4196873264))
* **register:** Hard remove old cache directory before renaming ([#846](https://github.com/architect-team/architect-cli/issues/846)) ([a9e2720](https://github.com/architect-team/architect-cli/commit/a9e2720b581c015a15d1afcba1c810e47c23d17d))
* **spec:** Remove parameters ([#808](https://github.com/architect-team/architect-cli/issues/808)) ([72cb793](https://github.com/architect-team/architect-cli/commit/72cb7937ad82239add6807eee65c27fbde4cbd31))


### Features

* **dev:restart:** Add dev:restart command ([#842](https://github.com/architect-team/architect-cli/issues/842)) ([93d10cf](https://github.com/architect-team/architect-cli/commit/93d10cf01ffb5a75f00aa3a46f54c616d8a00750))

## [1.33.2](https://github.com/architect-team/architect-cli/compare/v1.33.1...v1.33.2) (2023-02-23)


### Bug Fixes

* **analytics:** Fix issue with incorrect distinct id ([#834](https://github.com/architect-team/architect-cli/issues/834)) ([926902e](https://github.com/architect-team/architect-cli/commit/926902e294f30b2763a7ed9cc33bdb0cf2098c83))
* **deploy:** Support deploying multiple components in one pipeline ([#837](https://github.com/architect-team/architect-cli/issues/837)) ([0457eed](https://github.com/architect-team/architect-cli/commit/0457eedd40e9923f7462eb7f73b8bc27ea733f48))

## [1.33.1](https://github.com/architect-team/architect-cli/compare/v1.33.0...v1.33.1) (2023-02-17)


### Bug Fixes

* **build:** Fixed issue with an optimization bug that saves time when two services use the same Dockerfile ([1cc9315](https://github.com/architect-team/architect-cli/commit/1cc9315f370769c3303603cda5706fbce562ccff))

# [1.33.0](https://github.com/architect-team/architect-cli/compare/v1.32.1...v1.33.0) (2023-02-13)


### Bug Fixes

* **account:** Allow uppercase account name ([#822](https://github.com/architect-team/architect-cli/issues/822)) ([2b145bc](https://github.com/architect-team/architect-cli/commit/2b145bc89fe130584c7bfef0cb79d821b9e717de))
* **cluster:** Add minimum supported version for clusters. Currently set to 1.2.2 ([a25ee6c](https://github.com/architect-team/architect-cli/commit/a25ee6cfa6620e8ae1f73e85b578a65b01ee7725))
* **lint:** Only run linter for git on changed files ([#819](https://github.com/architect-team/architect-cli/issues/819)) ([77aa221](https://github.com/architect-team/architect-cli/commit/77aa221a5642b21da3edf1fcfb1145ca62344737))
* **posthog:** Don't identify with an anon id ([#825](https://github.com/architect-team/architect-cli/issues/825)) ([50e207b](https://github.com/architect-team/architect-cli/commit/50e207b97185bbdb6da9309cf98b88f702462f3e))
* **release:** Manually trigger release ([5c0696b](https://github.com/architect-team/architect-cli/commit/5c0696bb4765111b551e86320d25b4c0ccd69e03))
* **schema:** Fix branch name for json schema ([#817](https://github.com/architect-team/architect-cli/issues/817)) ([5a10acc](https://github.com/architect-team/architect-cli/commit/5a10acc2ac39d48546d7f0b2035f97e552a34a3b))
* **ux:** Add list alias for cmds ([#814](https://github.com/architect-team/architect-cli/issues/814)) ([224f6be](https://github.com/architect-team/architect-cli/commit/224f6be2625c53c050bc88f6b02e16a85cec22b2))


### Features

* **analytics:** added posthog ([#823](https://github.com/architect-team/architect-cli/issues/823)) ([7cd9e3f](https://github.com/architect-team/architect-cli/commit/7cd9e3f834160c29d70b9f181e91b57e8c274ef7))
* **build:** Add buildpack as an experimental feature ([fa7995f](https://github.com/architect-team/architect-cli/commit/fa7995fb17e4edc66ffea9eddf43f5015bed0890))
* **cli:** Added command to log ingress URLs associated with an environment ([#827](https://github.com/architect-team/architect-cli/issues/827)) ([24cd029](https://github.com/architect-team/architect-cli/commit/24cd029cc3ab526898716b886ec72214e81411d0))

## [1.32.1](https://github.com/architect-team/architect-cli/compare/v1.32.0...v1.32.1) (2023-01-23)


### Bug Fixes

* **register:** Don't register optional services ([58efbd5](https://github.com/architect-team/architect-cli/commit/58efbd519290e2e5ff04dd2af79527adde073714))

# [1.32.0](https://github.com/architect-team/architect-cli/compare/v1.31.1...v1.32.0) (2023-01-20)


### Bug Fixes

* **auth:** Add timeout to getToken ([#799](https://github.com/architect-team/architect-cli/issues/799)) ([5e5963b](https://github.com/architect-team/architect-cli/commit/5e5963be3f18d9ba5732e099365ff6a1e30c5548))
* **clusters:** Incorrect cluster command when warning about deprecated platform command ([#796](https://github.com/architect-team/architect-cli/issues/796)) ([3e5a74a](https://github.com/architect-team/architect-cli/commit/3e5a74a7711c35e22a78e5597a51ec28838deb2b))
* **dev:** Improve error message when docker build fails and prevent sending error reports ([#794](https://github.com/architect-team/architect-cli/issues/794)) ([a769260](https://github.com/architect-team/architect-cli/commit/a76926088848e98bcd2238b8538ad91c66db05ca))
* **register:** Add new accept header used by buildx 0.10.0 ([#803](https://github.com/architect-team/architect-cli/issues/803)) ([84706f4](https://github.com/architect-team/architect-cli/commit/84706f4f2a1b4a48f49f66525b853684599fd8da))
* **validate:** Upgrade class-transformer and class-validator ([#797](https://github.com/architect-team/architect-cli/issues/797)) ([647f880](https://github.com/architect-team/architect-cli/commit/647f880dcb27f3dd5a976eec30f3b49e2ff2e0a3))
* **volumes:** Disable volumes for remote deploys ([#800](https://github.com/architect-team/architect-cli/issues/800)) ([68cf984](https://github.com/architect-team/architect-cli/commit/68cf984c2a4b28fc69a3e80e48f11de4cf87c846))


### Features

* **dev:** Add support for optional services ([#801](https://github.com/architect-team/architect-cli/issues/801)) ([25d229b](https://github.com/architect-team/architect-cli/commit/25d229b43e17a16cd89c5d24eae4e700fcae4d08))

## [1.31.1](https://github.com/architect-team/architect-cli/compare/v1.31.0...v1.31.1) (2023-01-05)


### Bug Fixes

* **deploy:** display URLs after deploy even when label isnt specified  ([#791](https://github.com/architect-team/architect-cli/issues/791)) ([2c9f03b](https://github.com/architect-team/architect-cli/commit/2c9f03bda811958f6a226e759739ac26734f0974))
* **monitoring:** add nullsafe chain, and filter out potential null ([#789](https://github.com/architect-team/architect-cli/issues/789)) ([c2fa44e](https://github.com/architect-team/architect-cli/commit/c2fa44e24cd7cb5791d2ae04497688c5ed291b77))

# [1.31.0](https://github.com/architect-team/architect-cli/compare/v1.30.0...v1.31.0) (2022-12-22)


### Bug Fixes

* **dev:** Fix default args for multiple args ([#786](https://github.com/architect-team/architect-cli/issues/786)) ([5cdbdc1](https://github.com/architect-team/architect-cli/commit/5cdbdc113ba1c0971b45a0c95543fb95e72268c5))


### Features

* **deploy:** Deployment UX updates ([#769](https://github.com/architect-team/architect-cli/issues/769)) ([37aea9b](https://github.com/architect-team/architect-cli/commit/37aea9b2460ca0d488c92eb665d1b60a0cd254b6))

# [1.30.0](https://github.com/architect-team/architect-cli/compare/v1.29.0...v1.30.0) (2022-12-14)


### Bug Fixes

* **graph:** Fix dependency edges for new interfaces spec ([#776](https://github.com/architect-team/architect-cli/issues/776)) ([1913d8e](https://github.com/architect-team/architect-cli/commit/1913d8ee044ccf6ef23da5b022945fd5c81f1f08))
* **register:** Fixing register for services with reserved names ([#777](https://github.com/architect-team/architect-cli/issues/777)) ([6f465af](https://github.com/architect-team/architect-cli/commit/6f465af9cd0cccc7e6cd2364f750abc8a2e46ae0))
* **reserved_name:** Remove architect_ref to avoid confusion ([#778](https://github.com/architect-team/architect-cli/issues/778)) ([4967e7d](https://github.com/architect-team/architect-cli/commit/4967e7d89e4bd927bbcb5c701d8433ee2ddc960e))
* **sentry:** Log flags/commands as tags for searching ([#762](https://github.com/architect-team/architect-cli/issues/762)) ([d821dea](https://github.com/architect-team/architect-cli/commit/d821dea129164ec92d768650d586113753f7d95c))
* **webkit:** Add check for regex lookbehind support ([#770](https://github.com/architect-team/architect-cli/issues/770)) ([8698a2d](https://github.com/architect-team/architect-cli/commit/8698a2d4a45c12afb7f61a7a0cf171577dafcdde))
* **webkit:** regex ([#771](https://github.com/architect-team/architect-cli/issues/771)) ([b74cccd](https://github.com/architect-team/architect-cli/commit/b74cccd44c4a91d2a739339fd790d8dc76f16629))
* **webkit:** Use RegExp so catch triggers ([cccfded](https://github.com/architect-team/architect-cli/commit/cccfdedf10223cc7ce5350612bdcc9dbc24c9f96))


### Features

* **spec:** Deprecate top level interfaces block ([#775](https://github.com/architect-team/architect-cli/issues/775)) ([9144120](https://github.com/architect-team/architect-cli/commit/91441202a9177e4df32f94723419d6845ef16ffd))

# [1.29.0](https://github.com/architect-team/architect-cli/compare/v1.28.0...v1.29.0) (2022-12-01)


### Bug Fixes

* **cluster:** Updated examples to remove type flag. ([4e58979](https://github.com/architect-team/architect-cli/commit/4e5897909c9e1bb571a9cad1f157fe427579b105))
* **dev:** Fix race condition inspecting containers that no longer exist, fixed bug with service_ref / full_service_name being incorrect, only log healthcheck once each time it happens ([#763](https://github.com/architect-team/architect-cli/issues/763)) ([734356a](https://github.com/architect-team/architect-cli/commit/734356a60553984e0ac5fef2aa7014dc56ecfb50))
* **register:** Default register path to ./architect.yml ([#765](https://github.com/architect-team/architect-cli/issues/765)) ([01fa335](https://github.com/architect-team/architect-cli/commit/01fa335c8ce42c0ff5c1be3303656827bf37b936))
* **register:** Fix warning when dependencies are already registered ([#766](https://github.com/architect-team/architect-cli/issues/766)) ([a593ea9](https://github.com/architect-team/architect-cli/commit/a593ea9286eccdae0d1a8b79cb3a70c79e7e0553))
* **validation:** validator for looser validation on account names ([#761](https://github.com/architect-team/architect-cli/issues/761)) ([93d6859](https://github.com/architect-team/architect-cli/commit/93d6859d156e0153115f13e6baaa5c67d17e54ae))


### Features

* **dev:** loading a .env file for architect environment variables ([#753](https://github.com/architect-team/architect-cli/issues/753)) ([dc0f0bc](https://github.com/architect-team/architect-cli/commit/dc0f0bca3591a8cca1a39cc20c5fec1498d021d6))
* **dev:** Log errors when liveness probe fails ([#759](https://github.com/architect-team/architect-cli/issues/759)) ([0c65d19](https://github.com/architect-team/architect-cli/commit/0c65d194b8f0dd4a3816406d43e454b7a0cb9ca7))
* **environment:create:** Warn when environment creation fails due to already existing environment ([#556](https://github.com/architect-team/architect-cli/issues/556)) ([bb17f80](https://github.com/architect-team/architect-cli/commit/bb17f80912cbd6a38b32f45978180c5d3d2f7822))
* **init:** Support creating projects from Architect templates ([#612](https://github.com/architect-team/architect-cli/issues/612)) ([45283a0](https://github.com/architect-team/architect-cli/commit/45283a0eeaad8f9b70af32845f18a1ba6eaa9e3e)), closes [#695](https://github.com/architect-team/architect-cli/issues/695)
* **secrets:** Allow secrets from a remote env to be used in local development ([012e459](https://github.com/architect-team/architect-cli/commit/012e4594090612dd551d13884201550590e83599))

# [1.28.0](https://github.com/architect-team/architect-cli/compare/v1.27.0...v1.28.0) (2022-11-09)


### Bug Fixes

* **ci:** Add CI error message in prompts ([#752](https://github.com/architect-team/architect-cli/issues/752)) ([4ec5ff4](https://github.com/architect-team/architect-cli/commit/4ec5ff453fb02323b0141eb4afbbfbe028d464b4))
* **dev:** 554 re-enable http/https validation ([#747](https://github.com/architect-team/architect-cli/issues/747)) ([975e274](https://github.com/architect-team/architect-cli/commit/975e274f0f74b5519eb5f9ef55894cd3617ffae6))
* **login:** reset docker login on token refresh ([85fdde6](https://github.com/architect-team/architect-cli/commit/85fdde609e0e0a71f284e944715028cb6ea6cf47))
* **tasks:** 559 fix tasks ([#748](https://github.com/architect-team/architect-cli/issues/748)) ([8c67adc](https://github.com/architect-team/architect-cli/commit/8c67adcd148dd2c8e364a38b7b90efe9c940b927))


### Features

* **deploy:** Init volumes ([#735](https://github.com/architect-team/architect-cli/issues/735)) ([711abe7](https://github.com/architect-team/architect-cli/commit/711abe77415b866175019c909df706958392f231))
* **register:** Warn users if they are missing dependencies ([4767fe0](https://github.com/architect-team/architect-cli/commit/4767fe0d16f5533b4652f057b192076e9e7e8d30))

# [1.27.0](https://github.com/architect-team/architect-cli/compare/v1.26.0...v1.27.0) (2022-10-24)


### Bug Fixes

* **deploy:** Tmp remove protocol validation ([1217783](https://github.com/architect-team/architect-cli/commit/1217783b87433c2542e34fd594c1e9f5e40a6c75))
* **dev:list:** fixing spelling ([#723](https://github.com/architect-team/architect-cli/issues/723)) ([7b37daa](https://github.com/architect-team/architect-cli/commit/7b37daa7e3266098506ff31289829c0c903a90ea))
* **dev:** support home directory for volume host_path ([e13e5e1](https://github.com/architect-team/architect-cli/commit/e13e5e1155b78335b4ffa4ac056c4f1870eef9d8))
* **env:create:** Env create platform flag ([#739](https://github.com/architect-team/architect-cli/issues/739)) ([3b7105c](https://github.com/architect-team/architect-cli/commit/3b7105cba99c4ed1ad6b28c7a039e4c4768c9718))
* **platform:** Clean up agent install ([#724](https://github.com/architect-team/architect-cli/issues/724)) ([ec59cf9](https://github.com/architect-team/architect-cli/commit/ec59cf9ee88de8d71406f5571eefdd6585931e0c))
* **register:** Ask user for account if they do not have access to the one specified in the architect.yml file ([9a6e413](https://github.com/architect-team/architect-cli/commit/9a6e4137fbdf71ca9e9614e89d99ad63b1b0f532))
* **spec:** add deploy block to serviceconfig ([491850d](https://github.com/architect-team/architect-cli/commit/491850d869f1bf639912caf458596aac97d6c5df))
* **spec:** Add validation for replicas/scaling ([#726](https://github.com/architect-team/architect-cli/issues/726)) ([6d42c48](https://github.com/architect-team/architect-cli/commit/6d42c487108e0cedbbb6e6af9268732f24885090))


### Features

* **cli:** Deprecated flags/commands ([#737](https://github.com/architect-team/architect-cli/issues/737)) ([4961854](https://github.com/architect-team/architect-cli/commit/49618545cd3e47e85e1b708f2844fd15f682e75b))
* **cli:** platforms -> clusters ([#732](https://github.com/architect-team/architect-cli/issues/732)) ([ae05772](https://github.com/architect-team/architect-cli/commit/ae057720fd983a536c6e0cac7cfc4ea6f177fa0e))
* **deploy:** Add runtime type validation for k8s deployment ([#730](https://github.com/architect-team/architect-cli/issues/730)) ([5ace7d8](https://github.com/architect-team/architect-cli/commit/5ace7d85682f3fb1466f09d3e462d40601829d09))
* **ingress:** Throw an error if using an unsupported protocol with ingresses. ([1255186](https://github.com/architect-team/architect-cli/commit/12551865fc561af6264070314f58b47796e44ea9))
* **secrets:** Add platform secret functionality ([5f63d23](https://github.com/architect-team/architect-cli/commit/5f63d239d991d4644af2e1eb9ca40dce02348d01))

# [1.26.0](https://github.com/architect-team/architect-cli/compare/v1.25.1...v1.26.0) (2022-09-29)


### Bug Fixes

* **analytics:** No longer report errors caused by missing software such as docker. ([51328c1](https://github.com/architect-team/architect-cli/commit/51328c1a6235f02dfd35afa39da6d8785549b232))
* **dev:list:** 544 no dev instances console message ([#720](https://github.com/architect-team/architect-cli/issues/720)) ([136b389](https://github.com/architect-team/architect-cli/commit/136b3898e743b6ee47bd6cbbe403f3afbc8b69b7))
* **dev:list:** always print json format, even on empty ([#721](https://github.com/architect-team/architect-cli/issues/721)) ([de5924f](https://github.com/architect-team/architect-cli/commit/de5924f395030f7f43aca73e2fcbfaad522675bd))
* **dev:list:** Ouptut container name for the container name instead of accidentally using the image name ([#715](https://github.com/architect-team/architect-cli/issues/715)) ([f77cccd](https://github.com/architect-team/architect-cli/commit/f77cccd419bf70521c1674f14f63e1b332745e7f))
* **dev:list:** requires docker and compose ([#708](https://github.com/architect-team/architect-cli/issues/708)) ([61bef4a](https://github.com/architect-team/architect-cli/commit/61bef4a146570bb697246256c04c84e6a7cd4e70))
* **dev:** add another check for compose version ([f5cacae](https://github.com/architect-team/architect-cli/commit/f5cacaed17fdecf286196604f50282e8bfa76e86))
* **dev:** Add safeguard to docker info call so that if it fails we report that docker daemon isnt running ([#700](https://github.com/architect-team/architect-cli/issues/700)) ([185eab8](https://github.com/architect-team/architect-cli/commit/185eab80f7aca171b813174437ad72740c62cb73))
* **dev:** Add traefik default cert via envs as opposed to volume ([#709](https://github.com/architect-team/architect-cli/issues/709)) ([0a1b7ad](https://github.com/architect-team/architect-cli/commit/0a1b7ade829e86aeb19bb2db30fad3d390b31100))
* **dev:** Fix https to https issue ([#704](https://github.com/architect-team/architect-cli/issues/704)) ([f2c1053](https://github.com/architect-team/architect-cli/commit/f2c10534184193b07b0c1da9e62ae8daa0d0dd04))
* **dev:** fixing info function when no containers are running ([#702](https://github.com/architect-team/architect-cli/issues/702)) ([d72eb06](https://github.com/architect-team/architect-cli/commit/d72eb060d17b2a62132def58ceb22cee4fdcf1c9))
* **dev:** Improve the way we handle local environments to avoid conflicts ([38623a6](https://github.com/architect-team/architect-cli/commit/38623a6c4715afd7066752e03dd89c73500c7b2a))
* **dev:** More gracefully handle situations where previous runs were unexpectedly stopped ([d32cfd5](https://github.com/architect-team/architect-cli/commit/d32cfd51da331a66e6baa93773e561eb80a52ccc))
* **examples:** Example docs updates ([#707](https://github.com/architect-team/architect-cli/issues/707)) ([49bff5e](https://github.com/architect-team/architect-cli/commit/49bff5e6e6b6bcd9f5fd69934b8ce76b4c789487))
* **exec:** Better support for non TTY terminals ([4b05615](https://github.com/architect-team/architect-cli/commit/4b056159a8d6b15e5c98d6a7ac663f64f4f4b7ae))
* **graph:** Make graph immutable ([#693](https://github.com/architect-team/architect-cli/issues/693)) ([6753170](https://github.com/architect-team/architect-cli/commit/675317032caa1dd91993fbda66d36e152957c209))
* **scale:** Do not display interpolation as an option ([#717](https://github.com/architect-team/architect-cli/issues/717)) ([9e1ec99](https://github.com/architect-team/architect-cli/commit/9e1ec993ebecd33dcfe63ebb936b1fc87998eab5))


### Features

* **dev:list:** Add output type to dev list ([#711](https://github.com/architect-team/architect-cli/issues/711)) ([63b1458](https://github.com/architect-team/architect-cli/commit/63b145816c5ba756b306b9b0e91cc7d6b46eeff9))
* **dev:** Optimize by not building the same dockerfile n times. ([#703](https://github.com/architect-team/architect-cli/issues/703)) ([9a19997](https://github.com/architect-team/architect-cli/commit/9a199971f24d9a2c46611d0a3c695ea041a7b655))
* **platform:** Enable agent on cli ([#684](https://github.com/architect-team/architect-cli/issues/684)) ([122e3d0](https://github.com/architect-team/architect-cli/commit/122e3d0b2403f4467ed9e74eef65c7d6534d48ef))
* **scale:** Scale command ([#701](https://github.com/architect-team/architect-cli/issues/701)) ([9c7b087](https://github.com/architect-team/architect-cli/commit/9c7b08789d0e2336ceb340b138849a404061de0c))
* **spec:** remove deprecated sidecars field ([#716](https://github.com/architect-team/architect-cli/issues/716)) ([2335a4e](https://github.com/architect-team/architect-cli/commit/2335a4e1b3d1357e593b0d20af89464cd7a8527e))
* **stop:** Add the dev:stop command ([a3617e7](https://github.com/architect-team/architect-cli/commit/a3617e751441693cc20d6e50debc0ebfecdf65f2))

## [1.25.1](https://github.com/architect-team/architect-cli/compare/v1.25.0...v1.25.1) (2022-09-01)


### Bug Fixes

* **docs:** Fix html in readme ([89307fc](https://github.com/architect-team/architect-cli/commit/89307fc21d692b07248152dea2007f6bb87765ca))

# [1.25.0](https://github.com/architect-team/architect-cli/compare/v1.24.0...v1.25.0) (2022-09-01)


### Bug Fixes

* **cli:** convert deployCommand auto-approve ([#685](https://github.com/architect-team/architect-cli/issues/685)) ([78f3209](https://github.com/architect-team/architect-cli/commit/78f32097e102fad82899750c3efdf99f970a741e))
* **cli:** Docker verify improved ([#679](https://github.com/architect-team/architect-cli/issues/679)) ([552cd77](https://github.com/architect-team/architect-cli/commit/552cd77b67410f30f78e43761dfb8e9eb5942ee4))
* **dev:** Dev command leaves containers running when process exits with an error ([#677](https://github.com/architect-team/architect-cli/issues/677)) ([b8e5165](https://github.com/architect-team/architect-cli/commit/b8e5165c5ec7b80f4a1ab4fa09859510e7229fb3))
* **dev:** Fixed host regex that shouldnt have a global match that caused regexp.exec to not work as desired ([#689](https://github.com/architect-team/architect-cli/issues/689)) ([1a6428d](https://github.com/architect-team/architect-cli/commit/1a6428d01578cf6ea4df05acb83a784d5837242a))
* **dev:** fixing healthcheck liveness probe protocol for port/path ([#678](https://github.com/architect-team/architect-cli/issues/678)) ([81e69f0](https://github.com/architect-team/architect-cli/commit/81e69f05a11e96e8c44000529f941d62af9452b5))
* **dev:** Handle edge cases when starting components with pre-existing containers ([9cffb28](https://github.com/architect-team/architect-cli/commit/9cffb2897562bbbbabeebc0fe71d6785f34bf052))
* **exec:** Handle case where older version of compose is used and ConfigFiles doesnt exist ([#681](https://github.com/architect-team/architect-cli/issues/681)) ([c0112d2](https://github.com/architect-team/architect-cli/commit/c0112d24b6746d25c5c272c9c7cd4edfbf257a63))
* **exec:** Handle terminal resize events in exec ([#675](https://github.com/architect-team/architect-cli/issues/675)) ([6ff95a5](https://github.com/architect-team/architect-cli/commit/6ff95a5040afb5f50500ec0914c8affd3aef2d21))
* **exec:** Improve error message for Windows PS users ([#680](https://github.com/architect-team/architect-cli/issues/680)) ([c214870](https://github.com/architect-team/architect-cli/commit/c214870cf3aa274ced0a29bea4971bd861f0ec76))
* **subdomain:** 488 prevent nested subdomain ([#674](https://github.com/architect-team/architect-cli/issues/674)) ([0445430](https://github.com/architect-team/architect-cli/commit/0445430cfcd545ba476bac3fac3dc048012c529f))


### Features

* **cli:** 496 consistent boolean flags ([#683](https://github.com/architect-team/architect-cli/issues/683)) ([4203c74](https://github.com/architect-team/architect-cli/commit/4203c7467864af7e53754836a858ea14878cd5f1))
* **dev:** Use local SSL for  ([#676](https://github.com/architect-team/architect-cli/issues/676)) ([536b38e](https://github.com/architect-team/architect-cli/commit/536b38ecd034c26fcc8aa6370c42098cccb1edcf))
* **exec:** 482 pass replica name ([#663](https://github.com/architect-team/architect-cli/issues/663)) ([84ce8c5](https://github.com/architect-team/architect-cli/commit/84ce8c50e54b853e15c1c5bcaf14f3a2999e3d3b))
* **register:** add register multiple components and test cases ([#657](https://github.com/architect-team/architect-cli/issues/657)) ([2bd1fd2](https://github.com/architect-team/architect-cli/commit/2bd1fd225c03e8dd0d9214717245e0c57d2289aa))

# [1.24.0](https://github.com/architect-team/architect-cli/compare/v1.23.0...v1.24.0) (2022-08-17)


### Bug Fixes

* **dev:** Query traefik api to find healthy services ([2ac6ed0](https://github.com/architect-team/architect-cli/commit/2ac6ed06791451dd9471dbf2782feb81d8be696b))
* **exec:** Handle multiple arguments after -- without requiring quotes ([#665](https://github.com/architect-team/architect-cli/issues/665)) ([d2859e9](https://github.com/architect-team/architect-cli/commit/d2859e9ee5a4060f6e9ed4bbc9c288c93a05a014))
* **exec:** Use a stream.Writable instead of stream.Transform - we never read from this stream and eventually the buffer is full ([#671](https://github.com/architect-team/architect-cli/issues/671)) ([4376a21](https://github.com/architect-team/architect-cli/commit/4376a216d9c69ff845a8140916c09ef0ba9e7899))
* **validate:** set process exit code for validation errors ([#655](https://github.com/architect-team/architect-cli/issues/655)) ([cd93baf](https://github.com/architect-team/architect-cli/commit/cd93baff215f08a7af183d6fffd4bb823b613d2f))


### Features

* **dev:** Ask for new gateway port of there is a conflict ([43fbbf2](https://github.com/architect-team/architect-cli/commit/43fbbf2069cc88bab4e2ebe7f28f4b0283c4a753))

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
