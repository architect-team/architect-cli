#!/usr/bin/env node

// Hide ExperimentalWarnings that appear from oclif when users are running earlier version of node 18
// https://github.com/netlify/cli/issues/4608#issuecomment-1452541908
process.removeAllListeners('warning');
process.on('warning', (l) => {
  if (l.name !== 'ExperimentalWarning') {
    console.warn(l);
  }
});

require('reflect-metadata')

const oclif = require('@oclif/core')

oclif.run().then(require('@oclif/core/flush')).catch(require('@oclif/core/handle'))
