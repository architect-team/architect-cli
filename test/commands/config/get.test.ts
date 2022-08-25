import { expect } from '@oclif/test';
import { mockArchitectAuth } from '../../utils/mocks';

describe('config:get', function () {

  const print = false;

  mockArchitectAuth
    .stdout({ print })
    .stderr({ print })
    .command(['config:get', 'log_level'])
    .timeout(20000)
    .it('config:get log_level', ctx => {
      expect(ctx.stdout).to.contain('debug')
    });
});
