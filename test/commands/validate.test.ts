import { expect } from 'chai';
import path from 'path';
import { mockArchitectAuth } from '../utils/mocks';

describe('architect validate component', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const cr = new RegExp(/\r/, 'g');
  const lf = new RegExp(/\n/, 'g');

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
      const expected_validation_error_name = `ValidationErrorscomponent: tests/invalid_schemafile: ${path.resolve(`test/mocks/invalidschema/architect.yml`)}:1:`;
      const validation_error_name = err.name.split('\n');
      const trimmed_validation_error_name = validation_error_name.map(line => line.replace(cr, '').trim());
      expect(trimmed_validation_error_name.join('')).contains(expected_validation_error_name);
    })
    .it('correctly displays prettyValidationErrors error message to screen in place of a stacktrace', ctx => {
      const expected_validation_error_stdout = [
        '›  1 | name: tests/invalid_schema',
        '|      ﹋﹋﹋﹋﹋﹋﹋﹋﹋﹋ must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32; optionally can be prefixed with a valid Architect account and separated by a slash (e.g. architect/component-name).',
        '2 |',
        '3 | services:',
        '›  4 |   invalid_schema:',
        '|   ﹋﹋﹋﹋﹋﹋﹋ must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32',
        '5 |     interfaces:',
        '6 |       main: 8080',
        '7 |',
        '8 | interfaces:',
        '›  9 |   invalid_schema: ${{ services.invalid_schema.interfaces.main.url }}',
        '|   ﹋﹋﹋﹋﹋﹋﹋ must contain only lower alphanumeric and single hyphens or underscores in the middle; max length 32',
        '10 |',
      ];
      const stdout_error_lines = ctx.stderr.split('\n');
      const trimmed_stdout_error_lines = stdout_error_lines.map(line => line.replace(cr, '').trim());
      expect(trimmed_stdout_error_lines.join('')).to.contain(expected_validation_error_stdout.join(''));
      expect(ctx.stdout).to.equal('');
    });
});
