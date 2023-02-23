#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const output = args[0];
console.log(`Writing ${output}...`)
if (!output) {
  throw new Error('No output path specified')
}

const readme = fs.readFileSync(path.join(__dirname, '..', 'README.md')).toString();

const readme_split = readme.split('---');
readme_split.shift();

// Remove top html since <source> tags don't render for mintlify mdx
const mdx = readme_split.join('---');

if (!mdx || mdx.length === readme.length) {
  throw new Error('Missing divider. Failed to convert.')
}

// Comments don't render for mintlify mdx
function removeComments(contents) {
  return contents.replace(/<!--.*-->/g, '')
}

fs.writeFileSync(output, removeComments(mdx));

console.log(`Done`)
