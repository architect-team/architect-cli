import { Hook } from '@oclif/core';
import semver from 'semver';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore // TODO:TJ
import pkg from '../../../package.json' assert { type: "json" };

const hook: Hook<'init'> = async function (_) {
  const version = pkg.engines.node;
  if (!semver.satisfies(process.version, version)) {
    this.error(`The required node version ${version} for the Architect CLI is not satisfied by your current node version ${process.version}.`);
  }
};

export default hook;
