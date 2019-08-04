import { expect, test } from '@oclif/test';

describe('install', () => {
  test
    .stdout()
    .timeout(10000)
    .command(['install', '--prefix', './test/calculator-sample-project/addition-service/', '--verbose'])
    .it('installs dependency stubs', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Installing dependencies for addition-service');
    });

  test
    .stdout()
    .timeout(15000)
    .command([
      'install',
      '--recursive',
      '--prefix', './test/calculator-sample-project/test-script/',
      '--verbose'
    ])
    .it('installs dependencies recursively', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Installing dependencies for test-script');
      expect(stdout).to.contain('Installing dependencies for division-service');
      expect(stdout).to.contain('Installing dependencies for rest');
      expect(stdout).to.contain('Installing dependencies for addition-service');
    });
});
