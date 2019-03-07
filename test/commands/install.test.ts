import {expect, test} from '@oclif/test';

describe('install', () => {
  test
    .stdout()
    .command(['install', '--prefix', './test/calculator-example/addition-service/'])
    .it('installs dependency stubs', ctx => {
      const {stdout} = ctx;
      expect(stdout).to.contain('Installing dependencies for addition-service');
    });

  test
    .stdout()
    .timeout(15000)
    .command([
      'install',
      '--recursive',
      '--prefix', './test/calculator-example/test-script/'
    ])
    .it('installs dependencies recursively', ctx => {
      const {stdout} = ctx;
      expect(stdout).to.contain('Installing dependencies for test-service');
      expect(stdout).to.contain('Installing dependencies for division-service');
      expect(stdout).to.contain('Installing dependencies for subtraction-service');
      expect(stdout).to.contain('Installing dependencies for addition-service');
    });
});
