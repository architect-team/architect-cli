import { expect } from '@oclif/test';
import chalk from 'chalk';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import AppConfig from '../../src/app-config/config';
import AppService from '../../src/app-config/service';
import Unlink from '../../src/commands/unlink';
import ARCHITECTPATHS from '../../src/paths';

const component_path = path.join(__dirname, '../../examples/hello-world/').toLowerCase().replace(/\/$/gi, '').replace(/\\$/gi, '');

describe('unlink', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(() => {
    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'info',
    });
    const tmp_linked_components_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_COMPONENT_MAP_FILENAME);
    fs.writeJSONSync(tmp_linked_components_file, {
      'examples/hello-world': component_path,
    });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().returns(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should fail unlink without component config', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Unlink.prototype, 'log', log_spy);

    const bad_path = path.join(__dirname, '../examples').toLowerCase();
    await Unlink.run([bad_path]);

    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(chalk.red(`No linked component found matching, ${bad_path}`));

    const linked_components_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_COMPONENT_MAP_FILENAME);
    const linked_components = fs.readJSONSync(linked_components_file);
    expect(linked_components).to.have.property('examples/hello-world', component_path);
  });

  it('should link component', async () => {
    const log_spy = sinon.fake.returns(null);
    sinon.replace(Unlink.prototype, 'log', log_spy);

    await Unlink.run([component_path]);

    expect(log_spy.calledOnce).to.equal(true);
    expect(log_spy.firstCall.args[0]).to.equal(chalk.green('Successfully unlinked examples/hello-world'));

    const linked_components_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_COMPONENT_MAP_FILENAME);
    const linked_components = fs.readJSONSync(linked_components_file);
    expect(linked_components).not.to.have.property('examples/hello-world');
  });
})
