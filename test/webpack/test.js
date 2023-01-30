const { validateOrRejectSpec } = require('../../lib/index.js');

validateOrRejectSpec({ name: 'my-component' });
console.log('Valid spec!');
