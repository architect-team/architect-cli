import { expect, test } from '@oclif/test';
import chalk from 'chalk';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon, { SinonSpy } from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import Link from '../../../src/commands/link';
import ARCHITECTPATHS from '../../../src/paths';

describe('link', () => {
  let tmp_dir = os.tmpdir();
  const linked_components_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_COMPONENT_MAP_FILENAME);
  const component_path = path.join(__dirname, '../../mocks/superset/').replace(/\/$/gi, '').replace(/\\$/gi, '');
  const bad_path = path.join(__dirname, '../examples').toLowerCase();

  beforeEach(() => {
    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'info',
    });
    const tmp_linked_components_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_COMPONENT_MAP_FILENAME);
    fs.writeJSONSync(tmp_linked_components_file, {});
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().returns(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    sinon.restore();
  });

  test
    .command(['link', bad_path])
    .catch(err => {
      expect(err.message).to.equal(`Could not find architect.yml at ${bad_path}`);
    })
    .it('should fail link without component config', () => {
      if (fs.existsSync(linked_components_file)) {
        const linked_components = fs.readJSONSync(linked_components_file);
        expect(linked_components).not.to.have.property('superset');
      }
    });

  test
    .stub(Link.prototype, 'log', sinon.fake.returns(null))
    .command(['link', component_path])
    .it('link a component', () => {
      const log_spy = Link.prototype.log as SinonSpy;
      expect(log_spy.calledOnce).to.equal(true);
      expect(log_spy.firstCall.args[0]).to.equal(`Successfully linked ${chalk.green('superset')} to local system at ${chalk.green(component_path)}.`);

      expect(fs.existsSync(linked_components_file)).to.be.true;
      const linked_components = fs.readJSONSync(linked_components_file);
      expect(linked_components).to.have.property('superset', component_path);
    });
});
