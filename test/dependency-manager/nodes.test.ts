import { expect } from '@oclif/test';
import axios from 'axios';
import { deserialize, serialize } from 'class-transformer';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { ExternalNode } from '../../src/dependency-manager/src/graph/node/external';
import { ServiceNode } from '../../src/dependency-manager/src/graph/node/service';

describe('nodes', function () {
  let graph: LocalDependencyGraph;

  beforeEach(async function () {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();

    const env_config_external = {
      "services": {
        "architect/frontend:latest": {
          "host": "frontend.host.arc",
          "port": 80
        },
        "architect/backend:latest": {}
      }
    };

    mock_fs({
      '/stack/arc.env.external.json': JSON.stringify(env_config_external),
    });

    moxios.stubRequest(`/accounts/architect/services/backend/versions/latest`, {
      status: 200,
      response: {
        id: 'b0fda212-c67d-44ec-875c-cbe0dfc34881',
        created_at: '2020-04-05T23:26:57.286Z',
        updated_at: '2020-04-05T23:26:57.286Z',
        tag: 'latest',
        digest:
          'sha256:72298d85ff1105706f378a7f4b0f2d7049ff088b263a9c73d6c5afd8e7aca69f',
        config:
        {
          __version: '1.0.0',
          name: 'architect/backend',
          dependencies: {},
          parameters: {},
          datastores: {},
          api: { type: 'rest' },
          interfaces: {},
          notifications: [],
          subscriptions: {},
          platforms: {},
          description: 'backend for test stack',
          keywords: [''],
          author: ['ryan-cahill'],
          license: 'MIT',
          language: 'node',
          port: '8080',
          debug: 'npm run start:dev'
        },
        service:
        {
          id: 'bf53c469-cf70-44e1-ba12-108666a769a9',
          name: 'backend',
          url: '10.0.2.2:50001/architect/backend',
          tags: ['latest'],
          repository: 'architect/backend',
          created_at: '2020-04-02T23:45:33.816Z',
          updated_at: '2020-04-02T23:45:33.816Z',
          account:
          {
            id: '93db6250-5586-4909-af1c-8ab3175f581b',
            created_at: '2020-04-02T17:36:23.631Z',
            updated_at: '2020-04-02T17:36:23.631Z',
            name: 'architect',
            display_name: null,
            description: '',
            location: null,
            website: null,
            is_public: false,
            default_user_id: null
          }
        }
      }
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.external.json');
    const serialized_graph = serialize(manager.graph);
    graph = deserialize(LocalDependencyGraph, serialized_graph);
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    moxios.uninstall();
    mock_fs.restore();
  });

  it('load ServiceNode', async () => {
    const service_node = graph.getNodeByRef('architect/backend:latest');
    expect(service_node instanceof ServiceNode).true;
  });

  it('load ExternalNode', async () => {
    const external_node = graph.getNodeByRef('architect/frontend:latest');
    expect(external_node instanceof ExternalNode).true;
  });
});
