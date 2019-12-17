import { expect } from '@oclif/test';
import axios from 'axios';
import { deserialize, serialize } from 'class-transformer';
import path from 'path';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { LocalServiceNode } from '../../src/common/dependency-manager/local-service-node';
import ServiceEdge from '../../src/dependency-manager/src/graph/edge/service';
import { ServiceConfigV1 } from '../../src/dependency-manager/src/service-config/v1';

describe('manager', function () {

  beforeEach(function () {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
  });

  it('serialize/deserialize graph', async () => {
    const calculator_env_config_path = path.join(__dirname, '../mocks/calculator-environment.json');
    const manager = await LocalDependencyManager.createFromPath(axios.create(), calculator_env_config_path);
    const serialized_graph = serialize(manager.graph);
    const graph = deserialize(LocalDependencyGraph, serialized_graph);

    expect(graph.version).eq('1.0.0')
    expect(graph.nodes).lengthOf(4);
    expect(graph.nodes[0]).instanceOf(LocalServiceNode);
    expect((graph.nodes[0] as LocalServiceNode).service_config).instanceOf(ServiceConfigV1);

    expect(graph.edges).lengthOf(3);
    expect(graph.edges[0]).instanceOf(ServiceEdge);
  });
});
