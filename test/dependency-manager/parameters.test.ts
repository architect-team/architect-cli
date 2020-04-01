import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import path from 'path';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { LocalServiceNode } from '../../src/common/dependency-manager/local-service-node';
import { ValueFromParameter } from '../../src/dependency-manager/src/manager';

describe('manager parameters', function () {
  let graph: LocalDependencyGraph;

  before(async () => {
    const calculator_env_config_path = path.join(__dirname, '../mocks/calculator-environment-parameters.json');
    const manager = await LocalDependencyManager.createFromPath(axios.create(), calculator_env_config_path);
    graph = manager.graph;
  })

  beforeEach(function () {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
  });

  it('value no override datastore', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest.primary')!;
    expect(addition_node.parameters.POSTGRES_DB).eq('addition_service');
  });

  it('valueFrom no override', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest')!;
    expect(addition_node.parameters.DB_PRIMARY_USER).eq('postgres');
  });

  it('valueFrom override valueFrom', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest')!;
    expect(addition_node.parameters.DB_PRIMARY_HOST).eq('postgres://dev:dev@architect.addition-service-rest.latest.primary:5432/sponsored-products_development');
  });

  it('value override valueFrom', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest')!;
    expect(addition_node.parameters.DB_PRIMARY_PORT).eq('5432');
  });


  it('valueFrom port from interface', async () => {
    const backend_json = {
      "name": "architect/backend",
      "interfaces": {
        "main": {
          "description": "main port",
          "port": "8080"
        },
        "secondary": {
          "description": "secondary port",
          "port": "8081"
        }
      }
    };

    const frontend_json = {
      "name": "architect/frontend",
      "dependencies": {
        "architect/backend": "latest"
      },
      "parameters": {
        "API_ADDR": {
          "default": {
            "valueFrom": {
              "dependency": "architect/backend:latest",
              "interface": "main",
              "value": "$MAIN_HOST:$MAIN_PORT"
            }
          }
        }
      }
    }

    const env_config = {
      "services": {
        "architect/frontend:latest": {
          "debug": {
            "path": "./src/frontend",
          }
        },
        "architect/backend:latest": {
          "debug": {
            "path": "./src/backend",
          }
        }
      }
    }

    mock_fs({
      '/stack/src/frontend/architect.json': JSON.stringify(frontend_json),
      '/stack/src/backend/architect.json': JSON.stringify(backend_json),
      '/stack/arc.env.json': JSON.stringify(env_config),
    });

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
    graph = manager.graph;

    const backend_node = graph.nodes.find(node => node.ref === 'architect/backend:latest') as LocalServiceNode;
    expect(backend_node!.parameters.MAIN_PORT).eq('8080');
    expect(backend_node!.parameters.SECONDARY_PORT).eq('8081');
    expect(backend_node!.ports.filter(port_pair => port_pair.target.toString() === '8080').length).eq(1);
    expect(backend_node!.ports.filter(port_pair => port_pair.target.toString() === '8081').length).eq(1);
    expect(backend_node!.service_config.getInterfaces().main.port).eq('8080');
    expect(backend_node!.service_config.getInterfaces().secondary.port).eq('8081');

    const frontend_node = graph.nodes.find(node => node.ref === 'architect/frontend:latest') as LocalServiceNode;
    const interfaced_value_from = frontend_node!.service_config.getParameters().API_ADDR.default as ValueFromParameter;
    expect(interfaced_value_from.valueFrom.interface).eq('main');
    expect(frontend_node!.parameters.API_ADDR).eq('architect.backend.latest:8080');
  });
});
