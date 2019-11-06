import {expect, test} from '@oclif/test';
import AppConfig from '../../../src/app-config/config';
import { execSync } from 'child_process';

describe('config:get', function() {
  this.timeout(15000);

  const fields: { [key: string]: string } = {
    registry_host: 'registry.architect.test',
    api_host: 'https://api.architect.test',
    log_level: 'debug',
  };

  for (const field of Object.keys(fields)) {
    describe(`default: ${field}`, function() {
      test
        .stdout()
        .command(['config:get', field])
        .it('returns value', ctx => {
          const default_config = new AppConfig();
          expect(ctx.stdout).to.contain(default_config[field]);
        });
    });

    describe(`non-default: ${field}`, function() {
      let original: string;

      before(function() {
        original = execSync(`./bin/run config:get ${field}`).toString();
        execSync(`./bin/run config:set ${field} ${fields[field]}`);
      });

      after(function() {
        execSync(`./bin/run config:set ${field} ${original}`);
      });

      test
        .stdout()
        .command(['config:get', field])
        .it('returns correct value', ctx => {
          expect(ctx.stdout).to.contain(fields[field]);
        });
    });
  }
});
