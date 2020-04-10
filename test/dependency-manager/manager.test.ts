import { expect } from '@oclif/test';
import axios from 'axios';
import { deserialize, serialize } from 'class-transformer';
import path from 'path';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { LocalServiceNode } from '../../src/common/dependency-manager/local-service-node';
import { ServiceNode } from '../../src/dependency-manager/src';
import DependencyGraph from '../../src/dependency-manager/src/graph';
import ServiceEdge from '../../src/dependency-manager/src/graph/edge/service';
import { ServiceConfigV1 } from '../../src/dependency-manager/src/service-config/v1';

describe('manager', function () {
  let graph: DependencyGraph;

  beforeEach(async function () {
    // Stub the logger
    sinon.replace(Build.prototype, 'log', sinon.stub());

    const calculator_env_config_path = path.join(__dirname, '../mocks/calculator-environment.json');
    const manager = await LocalDependencyManager.createFromPath(axios.create(), calculator_env_config_path);
    const serialized_graph = serialize(manager.graph);
    graph = deserialize(LocalDependencyGraph, serialized_graph);
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
  });

  it('serialize/deserialize graph', async () => {

    expect(graph.version).eq('1.0.0')
    expect(graph.nodes).lengthOf(4);
    expect(graph.nodes[0]).instanceOf(LocalServiceNode);
    expect((graph.nodes[0] as LocalServiceNode).service_config).instanceOf(ServiceConfigV1);

    expect(graph.edges).lengthOf(3);
    expect(graph.edges[0]).instanceOf(ServiceEdge);
  });

  it('create ServiceNode', async () => {
    const node = new ServiceNode({
      tag: 'test',
      image: 'image',
      service_config: new ServiceConfigV1(),
      ports: [{ target: 8080, expose: 80 }],
      parameters: {}
    });
    expect(node.tag).eq('test');

    node.state = {
      action: 'update',
      changes: [
        { action: 'update', before: 5, after: 6, key: 'test', type: 'test' }
      ]
    }
    expect(deserialize(ServiceNode, serialize(node)).state!.action).eq('update');
  });

  it('remove serviceNode', async () => {
    expect(graph.nodes).lengthOf(4);
    graph.removeNodeByRef('architect/addition-service-rest:latest');
    expect(graph.nodes).lengthOf(3);
  });

  it('remove graph edge', async () => {
    expect(graph.edges).lengthOf(3);
    graph.removeEdgeByRef(graph.edges[0].ref);
    expect(graph.edges).lengthOf(2);
  });

  it('get dependent nodes', async () => {
    const dependent_nodes = graph.getDependentNodes(graph.getNodeByRef('architect/addition-service-rest:latest'));
    expect(dependent_nodes).lengthOf(1);
    expect(dependent_nodes[0].ref).eq('architect/subtraction-service-rest:latest');
  });

  it('remove service with cleanup', async () => {
    graph.removeNode('architect/subtraction-service-rest:latest', true);
    expect(graph.nodes).lengthOf(1);
    expect(graph.nodes[0].ref).eq('architect/division-service-grpc:latest');
  });

  it('remove service without cleanup', async () => {
    graph.removeNode('architect/subtraction-service-rest:latest', false);
    expect(graph.nodes).lengthOf(3);
  });
});
