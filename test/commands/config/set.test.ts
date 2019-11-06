import {expect, test} from '@oclif/test';
import { execSync } from 'child_process';

describe('config:set', function() {
  const fields: { [key: string]: string } = {
    registry_host: 'registry.architect.test',
    api_host: 'https://api.architect.test',
    log_level: 'debug',
  };

  test
    .stdout()
    .command(['config:set', 'fake_param', 'fake_value'])
    .it('rejects invalid param', ctx => {
      console.log(ctx);
    });
})
