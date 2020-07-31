import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../../src/dependency-manager/src';

describe('old expression-interpolation', function () {
  beforeEach(async () => {
    sinon.replace(Register.prototype, 'log', sinon.stub());
    moxios.install();
    moxios.wait(function () {
      let request = moxios.requests.mostRecent()
      if (request) {
        request.respondWith({
          status: 404,
        })
      }
    });
  });

  afterEach(function () {
    sinon.restore();
    mock_fs.restore();
    moxios.uninstall();
  });

  it('loadParameters with expressions', async () => {
    const frontend_config = {
      name: 'architect/cloud',
      interfaces: {
        app: '${ parameters.APP_PORT }'
      },
      dependencies: {
        'architect/cloud-api': 'v1'
      },
      environment: {
        APP_PORT: '${ parameters.APP_PORT }',
        DEP_DB_USER: '${ parameters.DEP_DB_USER }',
        lower_dep_ADMIN_PORT: '${ parameters.lower_dep_ADMIN_PORT }',
      },
      parameters: {
        APP_PORT: 8080,
        DEP_DB_USER: '${ dependencies["architect/cloud-api"].parameters.DB_USER }',
        lower_dep_ADMIN_PORT: '${ dependencies[\'architect/cloud-api\'].interfaces.admin.port }',
      }
    };

    moxios.stubRequest(`/accounts/architect/components/cloud/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/cloud:v1' } },
    });

    const postgres_config = {
      image: 'postgres:11',
      port: 5432,
      parameters: {
        DB_USER: 'dep-root'
      }
    };

    moxios.stubRequest(`/accounts/postgres/components/postgres/versions/11`, {
      status: 200,
      response: { tag: '11', config: postgres_config, service: { url: 'architect/cloud:11' } },
    });

    const backend_config = {
      name: 'architect/cloud-api',
      interfaces: {
        api: 8080,
        admin: 8081,
        primary: 8082,
      },
      environment: {
        DB_USER: '${ parameters.DB_USER }',
      },
      parameters: {
        DB_USER: '${ dependencies[\'postgres/postgres\'].parameters.DB_USER }',
      },
      dependencies: {
        'postgres/postgres': '11'
      }
    };

    moxios.stubRequest(`/accounts/architect/components/cloud-api/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: backend_config, service: { url: 'architect/cloud-api:v1' } },
    });

    const env_config = {
      services: {
        'architect/cloud:v1': {}
      }
    };

    mock_fs({
      '/stack/src/cloud/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    const graph = await manager.getGraph();
    const frontend_node = graph.getNodeByRef('architect/cloud/service:v1') as ServiceNode;
    expect(Object.keys(frontend_node.node_config.getEnvironmentVariables())).members(['APP_PORT', 'DEP_DB_USER', 'lower_dep_ADMIN_PORT', 'HOST', 'PORT']);
    expect(frontend_node.interfaces.app.port).eq('8080');
    expect(frontend_node.node_config.getEnvironmentVariables()['APP_PORT']).eq('8080');
    expect(frontend_node.node_config.getEnvironmentVariables()['DEP_DB_USER']).eq('dep-root');
    expect(frontend_node.node_config.getEnvironmentVariables()['lower_dep_ADMIN_PORT']).eq('8081');
  });

  it('loadParameters-with-expressions-circular-dependency', async () => {
    const frontend_config = {
      name: 'architect/cloud',
      interfaces: {
        app: 8080
      },
      dependencies: {
      },
      parameters: {
        PARAM_A: '${ parameters.PARAM_B }',
        PARAM_B: '${ parameters.PARAM_A }',
      }
    };

    moxios.stubRequest(`/accounts/architect/components/cloud/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/cloud:v1' } },
    });

    const env_config = {
      services: {
        'architect/cloud:v1': {}
      }
    };

    mock_fs({
      '/stack/src/cloud/architect.json': JSON.stringify(frontend_config),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const start_time = Date.now();
    await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json')
      .catch(error => {
        expect(error.toString()).to.contain('Stack Overflow Error: You might have a circular reference in your ServiceConfig expression stack');
        const duration = Date.now() - start_time;
        expect(duration).to.be.lessThan(500); // the worst case scenario (stack overflow) shouldn't take longer than half a second
      });
  });
});
