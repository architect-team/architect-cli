import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import { mockArchitectAuth } from '../utils/mocks';

const validation_mocks_path = path.join(__dirname, '../mocks/validationerrors');

describe('architect validate component', function () {

  this.afterAll(() => {
    const tmp_dir = path.resolve(`${validation_mocks_path}/subdomain`);
    if (fs.existsSync(tmp_dir)) {
      fs.rmSync(tmp_dir, { recursive: true });
    }
  });

  const subdomain_token_to_config_yaml_string = (subdomain_token: string): string =>
    `name: tests/validatesubdomain
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

  fs.emptyDirSync(path.join(validation_mocks_path, '/subdomain'));

  describe('expect fail for invalid subdomain', () => {

    const invalid_subdomain_tokens = [
      '_',
      '-',
      '.',
      '..',
      '@.',
      '.@',
      '_.',
      '-.',
      '._',
      '.-',
      '@@',
      'dddddd2.com222',
      '@dddddd.ru:?',
      'dddddd22:89',
      '@ddddd@dd.dd@22-',
      'dddddd.net?1222',
      'dddddd.com:8080:',
      '.dddddd.com:8080:',
      '---dddddd.com',
      '$dddddd$.dd',
      'dddddd-.dd',
      'dddddd22.ddd-dddd@ddd.dd',
      'ddd-.ddd().dd%:222',
      'pop().dddddd.ddd',
      'dddddd-d=.dddddd?',
      ' ddds cript-d.org ',
      'dddddd.com::%',
      'dddddd:8080',
      'dddddd.com:*',
      '-ddd.ddd.com',
      '-ddd.com',
      'dd-.ddd.com',
      'ddddd.ddddd.e',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      'd-.dddddd.com',
      'ddd.ddd.ddd.ddd',
      'dddddd.@',
      '@.dddddd',
      'dddddd:d',
      'dddddd:',
      ' dddddd',
      'dddddd ',
      'd ddddd',
      'dddddd-',
      '-dddddd',
      'd111d_d-d',
      'd_d',
      'd_d_d',
      'd______d',
      'DDDDDD2.com222',
      '@DDDDDD.ru:?',
      'DDDDDD22:89',
      '@DDDDD@DD.DD@22-',
      'DDDDDD.net?1222',
      'DDDDDD.com:8080:',
      '.DDDDDD.com:8080:',
      '---DDDDDD.com',
      '$DDDDDD$.DD',
      'DDDDDD-.DD',
      'DDDDDD22.DDD-DDDD@DDD.DD',
      'DDD-.DDD().DD%:222',
      'pop().DDDDDD.DDD',
      'DDDDDD-D=.DDDDDD?',
      ' DDDs cript-D.org ',
      'DDDDDD.com::%',
      'DDDDDD:8080',
      'DDDDDD.com:*',
      '-DDD.DDD.com',
      '-DDD.com',
      'DD-.DDD.com',
      'DDDDD.DDDDD.e',
      'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
      'D-.DDDDDD.com',
      'DDD.DDD.DDD.DDD',
      'DDDDDD.@',
      '@.DDDDDD',
      'DDDDDD:D',
      'DDDDDD:',
      ' DDDDDD',
      'DDDDDD ',
      'D DDDDD',
      'DDDDDD-',
      '-DDDDDD',
      'D111D_D-D',
      'D_D',
      'D_D_D',
      'D______D',
    ];

    for (const invalid_subdomain_token of invalid_subdomain_tokens) {
      const test_tmp_sub_dir = fs.mkdtempSync(path.join(path.join(validation_mocks_path, '/subdomain/')));
      const tmp_test_file = path.resolve(`${test_tmp_sub_dir}/architect.yml`);

      fs.writeFileSync(tmp_test_file, subdomain_token_to_config_yaml_string(invalid_subdomain_token));

      mockArchitectAuth
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
          expect(ctx.stderr).to.contain('must contain alphanumeric character ([a-z0-9A-Z]), could contain dashes (-), underscores (_), and alphanumerics between.');
          expect(ctx.stdout).to.equal('');
        });
    }
  }).timeout(20000);

  describe('expect pass for valid subdomain', () => {

    const valid_subdomain_tokens = [
      '*',
      '@',
      '',
      'ddd',
      'ddd-ddd',
      'dd-dd-dd-dd',
      'd-----d',
      'dddddd1',
      '1dddddd',
      'd1d',
      'DDD',
      'DDD-DDD',
      'DD-DD-DD-DD',
      'D-----D',
      'D1D',
      'DDDDDD1',
      '1DDDDDD',
    ];

    for (const valid_subdomain_token of valid_subdomain_tokens) {
      const test_tmp_sub_dir = fs.mkdtempSync(path.join(path.join(validation_mocks_path, '/subdomain/')));
      const tmp_test_file = path.resolve(`${test_tmp_sub_dir}/architect.yml`);

      fs.writeFileSync(tmp_test_file, subdomain_token_to_config_yaml_string(valid_subdomain_token));

      mockArchitectAuth
        .stdout({ print })
        .stderr({ print })
        .command(['validate', tmp_test_file])
        .it(`'${valid_subdomain_token}'`, ctx => {
          expect(ctx.stdout).to.contain('tests/validatesubdomain');
          expect(ctx.stdout).to.contain(tmp_test_file);
        });
    }
  }).timeout(20000);

});
