import { expect, test } from '@oclif/test';
import { execSync } from 'child_process';

describe('build', () => {
  test
    .stdout()
    .command(['build', './test/calculator-sample-project/addition-service/grpc/'])
    .it('builds docker image', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Building docker image for architect/addition-service');
      const docker_images = execSync('docker images | grep architect/addition-service');
      expect(docker_images.toString()).to.contain('architect/addition-service');
    });

  test
    .stdout()
    .command(['build', '--recursive', './test/calculator-sample-project/subtraction-services/python/grpc/'])
    .it('builds images recursively', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Building docker image for architect/subtraction-service');
      expect(stdout).to.contain('Building docker image for architect/addition-service');

      const docker_images = execSync('docker images | grep architect/');
      expect(docker_images.toString()).to.contain('architect/subtraction-service');
      expect(docker_images.toString()).to.contain('architect/addition-service');
    });
});
