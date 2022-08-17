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

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/validationerrors/architect.yml'])
    .catch(err => {
      expect(process.exitCode).eq(1);
    })
    .it('correctly fails on an invalidation error with exit code 1');

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/validationerrors/architect.yml'])
    .catch(err => {
      expect(err.stack).undefined;
    })
    .it('correctly fails on an invalidation error with no stacktrace');

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/validationerrors/architect.yml'])
    .catch(err => {
      expect(err.name).to.contain('ValidationErrors');
      expect(err.name).to.contain('component: tests/validation_errors');
      expect(err.name).to.contain(`file: ${path.resolve(`test/mocks/validationerrors/architect.yml`)}`);
    })
    .it('correctly displays prettyValidationErrors error message to screen in place of a stacktrace', ctx => {
      expect(ctx.stderr).to.contain('›  1 | name: tests/validation_errors');
      expect(ctx.stderr).to.contain('must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32; optionally can be prefixed with a valid Architect account and separated by a slash (e.g. architect/component-name).');
      expect(ctx.stdout).to.equal('');
    });
});
