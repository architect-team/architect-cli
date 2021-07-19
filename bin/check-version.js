const semver = require('semver');
const version = require('../package').engines.node;

if (!semver.satisfies(process.version, version)) {
  console.log(`The required node version ${version} for the Architect CLI is not satisfied with your current node version ${process.version}.`);
  process.exit(1);
}
