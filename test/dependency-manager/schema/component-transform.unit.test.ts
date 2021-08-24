import { expect } from '@oclif/test';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import PortUtil from '../../../src/common/utils/port';
import { buildSpecFromYml, loadSourceYmlFromPathOrReject, Slugs, transformComponentSpec } from '../../../src/dependency-manager/src';

describe('component transform unit test', function () {
  beforeEach(async () => {

    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  it(`transformComponentSpec successfully transforms spec without instance_metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/architect.yml`);

    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec, source_yml, Slugs.DEFAULT_TAG);

    expect(config.services['api-db'].ref).to.equal('examples/superset/api-db:latest');
  });

  it(`transformComponentSpec successfully transforms spec with instance_metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/architect.yml`);

    const instance_metadata = {
      instance_name: 'instance-1',
      instance_id: 'test-instance-id',
      instance_date: new Date(),
    }
    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec, source_yml, Slugs.DEFAULT_TAG, instance_metadata);

    expect(config.services['api-db'].ref).to.equal('examples/superset/api-db:latest@instance-1');
  });
});
