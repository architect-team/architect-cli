import {expect, test} from '@oclif/test';
import {execSync} from 'child_process';

describe('build', () => {
  test
    .stdout()
    .timeout(7000)
    .command(['build', './test/calculator-example/addition-service/'])
    .it('builds docker image', ctx => {
      const {stdout} = ctx;
      expect(stdout).to.contain('Building docker image for addition-service');
      expect(stdout).to.contain('Installing dependencies for addition-service');
      expect(stdout).to.contain('Successfully built image for addition-service');

      const docker_images = execSync('docker images | grep architect-addition-service');
      expect(docker_images.toString()).to.contain('architect-addition-service');
    });

  test
    .stdout()
    .timeout(7000)
    .command(['build', '--tag', 'tag-override', './test/calculator-example/addition-service/'])
    .it('allows tag overrides', ctx => {
      const {stdout} = ctx;
      expect(stdout).to.contain('Building docker image for addition-service');
      expect(stdout).to.contain('Installing dependencies for addition-service');
      expect(stdout).to.contain('Successfully built image for addition-service');

      const docker_images = execSync('docker images | grep tag-override');
      expect(docker_images.toString()).to.contain('tag-override');
    });

  test
    .stdout()
    .timeout(15000)
    .command(['build', '--recursive', './test/calculator-example/python-subtraction-service/'])
    .it('builds images recursively', ctx => {
      const {stdout} = ctx;
      expect(stdout).to.contain('Building docker image for subtraction-service');
      expect(stdout).to.contain('Installing dependencies for subtraction-service');
      expect(stdout).to.contain('Successfully built image for subtraction-service');
      expect(stdout).to.contain('Building docker image for addition-service');
      expect(stdout).to.contain('Installing dependencies for addition-service');
      expect(stdout).to.contain('Successfully built image for addition-service');

      const docker_images = execSync('docker images | grep architect-');
      expect(docker_images.toString()).to.contain('architect-subtraction-service');
      expect(docker_images.toString()).to.contain('architect-addition-service');
    });
});
