import {expect} from '@oclif/test';
import {spawnSync} from 'child_process';
import * as path from 'path';

import SUPPORTED_LANGUAGES from '../src/common/supported-languages';

describe('launchers', () => {
  Object.values(SUPPORTED_LANGUAGES).forEach(language => {
    describe(language, () => {
      let script_path: string;

      before(() => {
        script_path = path.join(__dirname, '../launchers', language, 'launcher');
      });

      it('should fail w/out service path', () => {
        const {status, stderr} = spawnSync(script_path);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('Error: Missing required flag');
        expect(stderr.toString()).to.include('--service_path');
      });

      it('should fail w/out config path', () => {
        const {status, stderr} = spawnSync(script_path, ['--service_path', 'test_path']);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('Error: Missing required flag');
        expect(stderr.toString()).to.include('--config_path');
      });

      it('should fail w/out target port', () => {
        const {status, stderr} = spawnSync(script_path, ['--service_path', 'test_path', '--config_path', 'test_path']);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('Error: Missing required flag');
        expect(stderr.toString()).to.include('--target_port');
      });
    });
  });
});
