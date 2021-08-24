import axios from 'axios';
import { expect } from 'chai';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import PortUtil from '../../../src/common/utils/port';
import { buildInterfacesRef, deepMergeSpecIntoComponent } from '../../../src/dependency-manager/src';

describe('component dependencies test', function () {
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


  it(`adds external interface when referenced`, async () => {
    const manager = new LocalDependencyManager(axios.create(), {
      'tests/ingress-downstream': 'test/mocks/ingress/downstream/architect.yml',
      'tests/ingress-upstream': 'test/mocks/ingress/upstream/architect.yml'
    });

    const downstream_config = await manager.loadComponentConfig('tests/ingress-downstream:latest');
    const upstream_config = await manager.loadComponentConfig('tests/ingress-upstream:latest');

    const upstream_config_with_ingress = deepMergeSpecIntoComponent({
      interfaces: {
        'upstream-ingress': {
          url: '${{ services.upstream-service.interfaces.main.url }}',
          ingress: {
            subdomain: 'upstream-ingress',
            enabled: true,
          }
        }
      }
    }, upstream_config);

    const graph = await manager.getGraph([
      downstream_config,
      upstream_config_with_ingress,
    ]);

    const ingresses = graph.edges.filter(e => e.from === 'gateway');
    expect(ingresses.length).to.equal(2);

    const downstream_ingress = ingresses.filter(e => e.instance_id === 'tests/ingress-downstream:latest')[0];
    const upstream_ingress = ingresses.filter(e => e.instance_id === 'tests/ingress-upstream:latest')[0];

    expect(downstream_ingress.to).to.equal(buildInterfacesRef(downstream_config));
    expect(upstream_ingress.to).to.equal(buildInterfacesRef(upstream_config));
  });
});
