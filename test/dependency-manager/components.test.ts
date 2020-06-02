import { expect } from '@oclif/test';
import axios from 'axios';
import { classToPlain, plainToClass } from 'class-transformer';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('dependencies', function () {
  beforeEach(async () => {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
    moxios.install();
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
    // Restore fs
    mock_fs.restore();
    moxios.uninstall();
  });

  describe('standard components', function () {
    it('simple component', async () => {
      const component_config = {
        name: 'architect/cloud',
        services: {
          app: {
            interfaces: {
              main: 8080
            },
            parameters: {
              API_ADDR: '${ services.api.interfaces.main.url }'
            }
          },
          api: {
            interfaces: {
              main: 8080
            },
            parameters: {
              DB_ADDR: '${ services.db.interfaces.main.url }'
            }
          },
          db: {
            interfaces: {
              main: 5432
            }
          }
        }
      };

      const env_config = {
        components: {
          'architect/cloud': {
            'extends': 'file:.'
          }
        }
      };

      mock_fs({
        '/stack/architect.json': JSON.stringify(component_config),
        '/stack/arc.env.json': JSON.stringify(env_config),
      });

      const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json');
      const graph = manager.graph;
      expect(graph.nodes).length(3);
      expect(graph.nodes[0].ref).eq('architect/cloud/app:latest')
      expect(graph.nodes[1].ref).eq('architect/cloud/api:latest')
      expect(graph.nodes[2].ref).eq('architect/cloud/db:latest')
      expect(graph.edges).length(2);

      const plain_graph = classToPlain(graph);
      const loaded_graph = plainToClass(LocalDependencyGraph, plain_graph);
      expect(loaded_graph.nodes).length(3);
      expect(loaded_graph.nodes[0].ref).eq('architect/cloud/app:latest')
      expect(loaded_graph.nodes[1].ref).eq('architect/cloud/api:latest')
      expect(loaded_graph.nodes[2].ref).eq('architect/cloud/db:latest')
      expect(loaded_graph.edges).length(2);
    });
  });
});
