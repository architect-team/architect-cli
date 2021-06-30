import { expect } from '@oclif/test';
import axios from 'axios';
import yaml from 'js-yaml';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../src/commands/register';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import PortUtil from '../../src/common/utils/port';

describe('graph', () => {
  beforeEach(() => {
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    })

    sinon.replace(Register.prototype, 'log', sinon.stub());
    sinon.replace(PortUtil, 'isPortAvailable', async () => true);
    PortUtil.reset();
  });

  afterEach(() => {
    sinon.restore();
    mock_fs.restore();
    moxios.uninstall();
  });

  it('graph without interpolation', async () => {
    const component_config = `
      name: architect/component

      dependencies:
        architect/dependency: latest
        architect/missing-dependency: latest

      parameters:
        MYSQL_DATABASE:
          required: true

      interfaces:
        db: \${{ services.db.interfaces.mysql.url }}

      services:
        db:
          image: mysql:5.6.35
          command: mysqld
          interfaces:
            mysql:
              port: 3306
              protocol: mysql

        core:
          environment:
            ADDR: \${{ ingresses.db.url }}
            DEP_ADDR: \${{ dependencies.architect/dependency.interfaces.db.url }}
            DEP_INGRESS_ADDR: \${{ dependencies.architect/dependency.ingresses.db.url }}
            DEP_MISSING_ADDR: \${{ dependencies.architect/missing-dependency.interfaces.db.url }}
            DEP_MISSING_INGRESS_ADDR: \${{ dependencies.architect/missing-dependency.ingresses.db.url }}
    `;

    const dependency_config = `
      name: architect/dependency

      parameters:
        MYSQL_DATABASE:
          required: true

      interfaces:
        db: \${{ services.db.interfaces.mysql.url }}

      services:
        db:
          image: mysql:5.6.35
          command: mysqld
          interfaces:
            mysql:
              port: 3306
              protocol: mysql

        core:
          environment:
            ADDR: \${{ ingresses.db.url }}
    `;

    moxios.stubRequest(`/accounts/architect/components/component/versions/latest`, {
      status: 200,
      response: { tag: 'latest', config: yaml.load(component_config), service: { url: 'architect/component:latest' } }
    });

    moxios.stubRequest(`/accounts/architect/components/dependency/versions/latest`, {
      status: 200,
      response: { tag: 'latest', config: yaml.load(dependency_config), service: { url: 'architect/dependency:latest' } }
    });

    const manager = new LocalDependencyManager(axios.create());

    const graph = await manager.getGraph([
      await manager.loadComponentConfig('architect/component:latest'),
      await manager.loadComponentConfig('architect/dependency:latest')
    ], {}, false);

    expect(graph.nodes).to.have.length(7);
    expect(graph.edges).to.have.length(5);
  });
});
