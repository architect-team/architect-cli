import { expect, test } from '@oclif/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import sinon, { SinonSpy } from 'sinon';
import AppConfig from '../../../src/app-config/config';
import AppService from '../../../src/app-config/service';
import BaseTable from '../../../src/base-table';
import ListLinkedComponents from '../../../src/commands/link/list';
import ARCHITECTPATHS from '../../../src/paths';

describe('link:list', () => {
  let tmp_dir = os.tmpdir();

  beforeEach(() => {
    // Stub the log_level
    const config = new AppConfig('', {
      log_level: 'info',
    });

    const tmp_linked_components_file = path.join(tmp_dir, ARCHITECTPATHS.LINKED_COMPONENT_MAP_FILENAME);
    fs.writeJSONSync(tmp_linked_components_file, { 'superset': '../../mocks/superset/' });
    const tmp_config_file = path.join(tmp_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
    fs.writeJSONSync(tmp_config_file, config);
    const app_config_stub = sinon.stub().returns(new AppService(tmp_dir, '0.0.1'));
    sinon.replace(AppService, 'create', app_config_stub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('list linked components', async () => {
    const linked_components = { 'superset': '../../mocks/superset/' };
    const table = new BaseTable({ head: ['Component', 'Path'] });
    for (const entry of Object.entries(linked_components)) {
      table.push(entry);
    }

    test
      .stub(ListLinkedComponents.prototype, 'log', sinon.fake.returns(null))
      .command(['link:list'])
      .it('list all linked components', () => {
        const log_spy_list = ListLinkedComponents.prototype.log as SinonSpy;
        expect(log_spy_list.firstCall.args[0]).to.equal(table.toString());
      });
  });
})
