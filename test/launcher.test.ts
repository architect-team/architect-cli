import { expect } from '@oclif/test';
import { execSync, spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';

import MANAGED_PATHS from '../src/common/managed-paths';
import SUPPORTED_LANGUAGES from '../src/common/supported-languages';

describe('launchers', () => {
  Object.values(SUPPORTED_LANGUAGES).forEach(language => {
    describe(language, () => {
      let script_path: string;
      const calculator_example_path = path.join(__dirname, './calculator-example/');

      before(() => {
        script_path = path.join(__dirname, '../node_modules/.bin/', `architect-${language}-launcher`);
        process.env.PYTHONUNBUFFERED = 'true';
        process.env.ARCHITECT_ADDITION_SERVICE = JSON.stringify({
          host: '0.0.0.0',
          port: '8080',
          service_path: path.join(calculator_example_path, './addition-service/'),
          proto_prefix: 'service'
        });
      });

      it('should fail w/out service path', () => {
        const { status, stderr } = spawnSync(script_path);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('Missing required flag');
        expect(stderr.toString()).to.include('--service_path');
      });

      it('should fail w/out target port', () => {
        const { status, stderr } = spawnSync(script_path, [
          '--service_path', 'test_path'
        ]);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('Missing required flag');
        expect(stderr.toString()).to.include('--target_port');
      });

      it('should fail w/out stubs installed', () => {
        // Remove stubs from services
        execSync(`rm -rf ${path.join(
          calculator_example_path,
          `./addition-service/${MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY}`
        )}`);
        execSync(`rm -rf ${path.join(
          calculator_example_path,
          `./${language}-subtraction-service/${MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY}`
        )}`);

        const { status, stderr } = spawnSync(script_path, [
          '--service_path', path.join(__dirname, `./calculator-example/${language}-subtraction-service/`),
          '--target_port', '8081',
        ]);
        expect(status).not.to.be.eq(null);
        expect(status).not.to.be.eq(0);
        expect(stderr.toString()).to.include('subtraction-service has not been installed properly for subtraction-service');
      });

      it('should successfully start server', done => {
        const tmp_config_path = path.join(os.tmpdir(), `architect-test-launcher-${language}.json`);
        fs.writeFileSync(tmp_config_path, JSON.stringify({}));

        const service_path = path.join(__dirname, `./calculator-example/${language}-subtraction-service/`);
        execSync(`architect install --prefix=${service_path} --recursive`);

        const cmd = spawn(script_path, [
          '--service_path', service_path,
          '--target_port', '8081',
        ]);

        let isDone = false;
        let host: string;
        let port: string;
        readline.createInterface({
          input: cmd.stdout,
          terminal: false
        }).on('line', data => {
          data = data.trim();
          if (data.indexOf('Host: ') === 0) {
            host = data.toString().substring(6);
          } else if (data.indexOf('Port: ') === 0) {
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
      }).timeout(20000);
    });
  });
});
