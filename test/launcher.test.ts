import {expect} from '@oclif/test';
import {spawn, spawnSync} from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
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
        const {status, stderr} = spawnSync(script_path, [
          '--service_path', 'test_path',
          '--config_path', 'test_path'
        ]);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('Error: Missing required flag');
        expect(stderr.toString()).to.include('--target_port');
      });

      it('should successfully start server', done => {
        const tmp_config_path = path.join(os.tmpdir(), `architect-test-launcher-${language}.json`);
        fs.writeFileSync(tmp_config_path, JSON.stringify({}));

        const cmd = spawn(script_path, [
          '--service_path', path.join(__dirname, 'test-service/addition-service'),
          '--config_path', tmp_config_path,
          '--target_port', '8080',
        ]);

        let isDone = false;
        let host: string;
        let port: string;
        cmd.stdout.on('data', data => {
          if (data.toString().indexOf('Host: ') === 0) {
            host = data.toString().substring(6);
          } else if (data.toString().indexOf('Port: ') === 0) {
            port = data.toString().substring(6);
          }

          if (host && port) {
            isDone = true;
            cmd.kill();
          }
        });

        cmd.on('close', code => {
          expect(isDone).to.be.eq(true);
          expect(code).to.be.eq(null);
          done();
        });

        setTimeout(() => {
          cmd.kill();
        }, 2000);
      });
    });
  });
});
