import { expect } from 'chai';
import path from 'path';
import { mockArchitectAuth } from '../utils/mocks';

describe('architect validate component', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'examples/database-seeding/architect.yml'])
    .it('correctly validates an architect.yml file and prints name and source_file', ctx => {
      expect(ctx.stdout).to.contain(`database-seeding`);
      expect(ctx.stdout).to.contain(path.resolve(`examples/database-seeding/architect.yml`));
    });

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'examples/database-seeding/'])
    .it('correctly validates an architect.yml file given a directory and prints name and source_file', ctx => {
      expect(ctx.stdout).to.contain('database-seeding');
      expect(ctx.stdout).to.contain(path.resolve('examples/database-seeding/architect.yml'));
    });

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'examples/hello-world/architect.yml', 'examples/database-seeding/architect.yml'])
    .it('correctly validates an multiple files and prints name and source_file for each', ctx => {
      expect(ctx.stdout).to.contain('database-seeding');
      expect(ctx.stdout).to.contain(path.resolve('examples/database-seeding/architect.yml'));
      expect(ctx.stdout).to.contain('hello-world');
      expect(ctx.stdout).to.contain(path.resolve('examples/hello-world/architect.yml'));
    });

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'non-existent/directory/architect.yml'])
    .catch(err => {
      expect(err.message).to.contain(path.resolve('non-existent/directory/architect.yml'));
    })
    .it('correctly fails on a non-existent directory and prints an error message');

  // invalid subdomain test values
  const invalid_tokens = [
    'example2.com222',
    '@example.ru:?',
    'example22:89',
    '@jefe@dd.ru@22-',
    'example.net?1222',
    'example.com:8080:',
    '.example.com:8080:',
    '---test.com',
    '$dollars$.gb',
    'sell-.me',
    'open22.the-door@koll.ru',
    'mem-.wer().or%:222',
    'pop().addjocker.lon',
    'regular-l=.heroes?',
    ' ecmas cript-8.org ',
    'example.com::%',
    'example:8080',
    'example',
    'examaple.com:*',
    '-test.test.com',
    '-test.com',
    'dd-.test.com',
    'dfgdfg.dfgdf33.e',
    'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    'd-.test.com',
    'test.test.test.test',
    '..',
    '@.',
    '.@',
    '.',
    'test.@',
    '@.test',
    'tes:t',
    'test:',
    'test1',
    ' test',
    'test ',
    't est',
    'test-',
    '-test',
  ];

  const invalid_subdomains = invalid_tokens.map(token =>
`name: geforce
services:
  geforce:
    build:
      context: .
interfaces:
  geforce:
    url: \${{ services.geforce.interfaces.main.url }}
    ingress:
      subdomain: ${token}`
);
});
