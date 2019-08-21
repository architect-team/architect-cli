import { expect, test } from '@oclif/test';
import child_process from 'child_process';

const spawn = child_process.spawn;

describe('deploy', () => {
  test
    .stdout()
    // child_process stdio:inherit doesn't get captured by stubbed stdout()
    .stub(child_process, 'spawn', (a: any, b: any, c: any) => {
      if (c) {
        c.stdio = 'pipe';
      }
      const s = spawn(a, b, c);
      const readline = require('readline');
      const rl = readline.createInterface({
        input: s.stdout
      });
      rl.on('line', (line: any) => {
        // tslint:disable-next-line: no-console
        console.log(line);
      });
      return s;
    })
    .command(['deploy', '--local', './test/calculator-sample-project/test-script/'])
    .it('deploy local test-service', (ctx: any) => {
      const { stdout } = ctx;
      expect(stdout).to.contain('| 10');
    });
});
