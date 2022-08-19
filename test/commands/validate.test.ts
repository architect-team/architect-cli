import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import { Slugs } from '../../src/dependency-manager/spec/utils/slugs';
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
      ';',
      ':',
      '{}',
      '[]',
      '&',
      '%',
      '$',
      '#',
      '!',
      '~',
      '()',
      '<>',
      '=',
      '|',
      '+',
      ' ',
      '?',
      '\\x01',
      '\\r',
      '\\t',
      '\\n',
      '§¶ªªº•¬åß∆∂øˆå˜ßµøˆ¬ç',
      '💰🤦‍♂️',
      '\\',
      '/',
      'abcdef2.com222',
      '@ghijklmn.ru:?',
      'opqrs22:89',
      '@tuvwxyzrhrth@dd.dd@22-',
      'asdrgeth.net?1222',
      'sdpfps.com:8080:',
      '.opplmcllz.com:8080:',
      '---zzzoepo.com',
      '$yyyopawko$.dd',
      'llplwokmoe-.dd',
      'OIADIOd22.POLQO-PLQOKO@OOWPW.wz',
      'PQOPKoapo-.qqq().w%:222',
      'pop().fiopqiop.lpo',
      'poqi0293-d=.ddd?',
      ' abcs cript-w.org ',
      'oiqpodf9.com::%',
      'POICMqiwjp:8080',
      'ODKOoqkp.com:*',
      '-pwokd.aaa.com',
      '-pwoppow.com',
      'd-.popql.com',
      'zxncmbpqo.siopqi.e',
      'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890',
      'd-.aopskdop.com',
      'cxcd.qwd.aad.gqs',
      'op kqpo.@',
      '@.pijsdfvjn',
      'qopwkdopk:d',
      'zxmncb:',
      ' asjklfh',
      'qiopjdoi ',
      'asdk aodwoi',
      'aoif gois-',
      '-qoiwdj',
      'lll_l-i',
      'D_D',
      'D_D_D',
      'd______D',
    ];

    for (const invalid_subdomain_token of invalid_subdomain_tokens) {
      const test_tmp_sub_dir = fs.mkdtempSync(path.join(validation_mocks_path, '/subdomain/'));
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
          expect(ctx.stderr).to.contain(Slugs.ComponentSubdomainDescription);
          expect(ctx.stdout).to.equal('');
        });
    }
  }).timeout(20000);

  describe('expect pass for valid subdomain', () => {

    const valid_subdomain_tokens = [
      '*',
      '@',
      '',
      'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890',
      'abc-DEF',
      'gh-ij-kl-mn',
      'o-----p',
      'qrstuv1',
      '1xwyz',
      'A1B',
      'CD4F',
      'GHI-JKL',
      'MN-OP-QR-STV',
      'U--1--V',
      'W1X',
      'YZ1',
      'a-b-c-d-eFG-H',
    ];

    for (const valid_subdomain_token of valid_subdomain_tokens) {
      const test_tmp_sub_dir = fs.mkdtempSync(path.join(validation_mocks_path, '/subdomain/'));
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
