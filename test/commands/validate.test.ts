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
    .command(['validate', 'test/mocks/invalidschema/architect.yml'])
    .catch(err => {
      expect(process.exitCode).eq(1);
    })
    .it('correctly fails on an invalidation error with exit code 1');

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/invalidschema/architect.yml'])
    .catch(err => {
      expect(err.stack).undefined;
    })
    .it('correctly fails on an invalidation error with no stacktrace');

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['validate', 'test/mocks/invalidschema/architect.yml'])
    .catch(err => {
      expect(err.name).eq(`ValidationErrors\ncomponent: tests/invalid_schema\nfile: ${path.resolve(`test/mocks/invalidschema/architect.yml`)}:1:6`);
    })
    .it('correctly displays prettyValidationErrors error message to screen in place of a stacktrace', ctx => {
      const expected = [
        'ValidationErrors\n',
        'component: tests/invalid_schema\n',
        `file: ${path.resolve(`test/mocks/invalidschema/architect.yml`)}:1:6\n`,
        '›  1 | name: tests/invalid_schema\n',
        '     |      ﹋﹋﹋﹋﹋﹋﹋﹋﹋﹋ must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32; optionally can be prefixed with a valid Architect account and separated by a slash (e.g. architect/component-name).\n',
        '   2 | \n',
        '   3 | services:\n',
        '›  4 |   invalid_schema:\n',
        '     |   ﹋﹋﹋﹋﹋﹋﹋ must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32\n',
        '   5 |     interfaces:\n',
        '   6 |       main: 8080\n',
        '   7 | \n',
        '   8 | interfaces:\n',
        '›  9 |   invalid_schema: ${{ services.invalid_schema.interfaces.main.url }}\n',
        '     |   ﹋﹋﹋﹋﹋﹋﹋ must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32\n',
        '  10 | \n',
      ];
      expect(ctx.stderr).to.equal(expected.join(''));
      expect(ctx.stdout).to.equal('');
    });
});
