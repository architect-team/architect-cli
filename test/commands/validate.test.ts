import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import sinon from 'sinon';
import untildify from 'untildify';
import { Slugs } from '../../src/dependency-manager/spec/utils/slugs';
import { mockArchitectAuth } from '../utils/mocks';

describe('architect validate component', function () {
  const subdomain_token_to_config_yaml_string = (subdomain_token: string): string =>
    `name: validatesubdomain
services:
  validatesubdomain:
    build:
      context: .
interfaces:
  validatesubdomain:
    url: \${{ services.validatesubdomain.interfaces.main.url }}
    ingress:
      subdomain: '${subdomain_token}'`;

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'examples/database-seeding/architect.yml'])
    .it('correctly validates an architect.yml file and prints name and source_file', ctx => {
      expect(ctx.stdout).to.contain(`database-seeding`);
      expect(ctx.stdout).to.contain(path.resolve(`examples/database-seeding/architect.yml`));
    });

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'examples/database-seeding/'])
    .it('correctly validates an architect.yml file given a directory and prints name and source_file', ctx => {
      expect(ctx.stdout).to.contain('database-seeding');
      expect(ctx.stdout).to.contain(path.resolve('examples/database-seeding/architect.yml'));
    });

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'examples/hello-world/architect.yml', 'examples/database-seeding/architect.yml'])
    .it('correctly validates an multiple files and prints name and source_file for each', ctx => {
      expect(ctx.stdout).to.contain('database-seeding');
      expect(ctx.stdout).to.contain(path.resolve('examples/database-seeding/architect.yml'));
      expect(ctx.stdout).to.contain('hello-world');
      expect(ctx.stdout).to.contain(path.resolve('examples/hello-world/architect.yml'));
    });

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'non-existent/directory/architect.yml'])
    .catch(err => {
      expect(err.message).to.contain(path.resolve('non-existent/directory/architect.yml'));
    })
    .it('correctly fails on a non-existent directory and prints an error message');

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/validationerrors/architect.yml'])
    .catch(err => {
      expect(process.exitCode).eq(1);
    })
    .it('correctly fails on an invalidation error with exit code 1');

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/validationerrors/architect.yml'])
    .catch(err => {
      expect(err.stack).undefined;
    })
    .it('correctly fails on an invalidation error with no stacktrace');

  mockArchitectAuth()
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/validationerrors/architect.yml'])
    .catch(err => {
      expect(err.name).to.contain('ValidationErrors');
      expect(err.name).to.contain('component: validation_errors');
      expect(err.name).to.contain(`file: ${path.resolve(`test/mocks/validationerrors/architect.yml`)}`);
    })
    .it('correctly displays prettyValidationErrors error message to screen in place of a stacktrace', ctx => {
      expect(ctx.stderr).to.contain('›  1 | name: validation_errors');
      expect(ctx.stderr).to.contain('must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32');
      expect(ctx.stdout).to.equal('');
    });

  describe('expect fail for invalid subdomain', () => {
    const invalid_subdomain_tokens = [
      '_',
    ];

    const tmp_test_file = path.normalize(untildify('~/some_fake_file.yml'));
    for (const invalid_subdomain_token of invalid_subdomain_tokens) {
      mockArchitectAuth()
        .stub(fs, 'readFileSync', sinon.fake.returns(subdomain_token_to_config_yaml_string(invalid_subdomain_token)))
        .stub(fs, 'lstatSync', sinon.fake.returns({
          isDirectory: () => false,
        }))
        .stdout({ print })
        .stderr({ print })
        .command(['validate', tmp_test_file])
        .catch(err => {
          expect(err.name).to.contain('ValidationErrors');
          expect(err.name).to.contain(tmp_test_file);
          expect(process.exitCode).eq(1);
          expect(err.stack).undefined;
        })
        .it(`'${invalid_subdomain_token}'`, ctx => {
          expect(ctx.stderr).to.contain(`› 10 |       subdomain: '${invalid_subdomain_token}'`);
          expect(ctx.stderr).to.contain(Slugs.ComponentSubdomainDescription);
          expect(ctx.stdout).to.equal('');
        });
    }
  }).timeout(20000);

  describe('expect pass for valid subdomain', () => {
    const valid_subdomain_tokens = [
      'qrstuv1'
    ];

    const tmp_test_file = path.normalize(untildify('~/some_fake_file.yml'));
    for (const valid_subdomain_token of valid_subdomain_tokens) {
      mockArchitectAuth()
        .stub(fs, 'readFileSync', sinon.fake.returns(subdomain_token_to_config_yaml_string(valid_subdomain_token)))
        .stub(fs, 'lstatSync', sinon.fake.returns({
          isDirectory: () => false,
        }))
        .stdout({ print })
        .stderr({ print })
        .command(['validate', tmp_test_file])
        .it(`'${valid_subdomain_token}'`, ctx => {
          expect(ctx.stdout).to.contain('validatesubdomain');
          expect(ctx.stdout).to.contain(tmp_test_file);
        });
    }
  }).timeout(20000);
});
