import { Hook } from '@oclif/config';
import semver from 'semver';
import { engines } from '../../../package';

const hook: Hook<'init'> = async function (options) {
  const version = engines.node;
  if (!semver.satisfies(process.version, version)) {
    console.log(`The required node version ${version} for the Architect CLI is not satisfied by your current node version ${process.version}.`);
    process.exit(1);
  }
};

export default hook;
