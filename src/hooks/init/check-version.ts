import { Hook } from '@oclif/core';
import semver from 'semver';

const hook: Hook<'init'> = async function (options) {
  const version = require('../../../package').engines.node;
  if (!semver.satisfies(process.version, version)) {
    this.error(`The required node version ${version} for the Architect CLI is not satisfied by your current node version ${process.version}.`);
  }
};

export default hook;
