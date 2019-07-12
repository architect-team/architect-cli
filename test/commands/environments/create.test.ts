import { expect, test } from '@oclif/test';
import { execSync } from 'child_process';

describe('create', () => {
  test
    .stdout()
    .timeout(10000)
    .command(['envs:create'])
    .it('creates an environment', ctx => {
      const { stdout } = ctx;
      expect(stdout).to.contain('Building docker image for addition-service');
      const docker_images = execSync('docker images | grep architect-addition-service');
      expect(docker_images.toString()).to.contain('architect-addition-service');
    });
});
