import { expect } from '@oclif/test';
import axios from 'axios';
import { deserialize, serialize } from 'class-transformer';
import path from 'path';
import sinon from 'sinon';
import Register from '../../../src/commands/register';
import LocalDependencyManager from '../../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../../src/dependency-manager/src';
import DependencyGraph from '../../../src/dependency-manager/src/graph';
import ServiceEdge from '../../../src/dependency-manager/src/graph/edge/service';
import InterfacesNode from '../../../src/dependency-manager/src/graph/node/interfaces';
import { ServiceConfigV1 } from '../../../src/dependency-manager/src/service-config/v1';

describe('old manager', function () {
  let graph: DependencyGraph;

  beforeEach(async function () {
    // Stub the logger
    sinon.replace(Register.prototype, 'log', sinon.stub());

    const calculator_env_config_path = path.join(__dirname, '../../mocks/calculator-environment.json');
    const manager = await LocalDependencyManager.createFromPath(axios.create(), calculator_env_config_path);
    const serialized_graph = serialize(await manager.getGraph());
    graph = deserialize(DependencyGraph, serialized_graph);
  });

  afterEach(function () {
    // Restore stubs
    sinon.restore();
  });

  it('serialize/deserialize graph', async () => {
    expect(graph.nodes).lengthOf(7);

    expect(graph.nodes[0]).instanceOf(InterfacesNode);
    expect(graph.nodes[1].is_local).true;
    expect((graph.nodes[1] as ServiceNode).node_config).instanceOf(ServiceConfigV1);

    expect(graph.edges).lengthOf(6);
    expect(graph.edges[0]).instanceOf(ServiceEdge);
  });

  it('create ServiceNode', async () => {
    const node = new ServiceNode({
      ref: 'test',
      node_config: new ServiceConfigV1(),
    });

    node.state = {
      action: 'update',
      changes: [
        { action: 'update', before: 5, after: 6, key: 'test', type: 'test' }
      ]
    }
    expect(deserialize(ServiceNode, serialize(node)).state!.action).eq('update');
  });

  it('remove serviceNode', async () => {
    expect(graph.nodes).lengthOf(7);
    graph.removeNodeByRef('architect/addition-service-rest/service:latest');
    expect(graph.nodes).lengthOf(6);
  });

  it('remove graph edge', async () => {
    expect(graph.edges).lengthOf(6);
    graph.removeEdgeByRef(graph.edges[0].ref);
    expect(graph.edges).lengthOf(5);
  });

  it('get dependent nodes', async () => {
    const dependent_nodes = graph.getDependentNodes(graph.getNodeByRef('architect/addition-service-rest/service:latest'));
    expect(dependent_nodes).lengthOf(1);
    expect(dependent_nodes[0].ref).eq('architect/addition-service-rest:latest-interfaces');
  });

  it('remove service with cleanup', async () => {
    graph.removeNode('architect/subtraction-service-rest/service:latest', true);
    expect(graph.nodes).lengthOf(3);
    expect(graph.nodes[0].ref).eq('architect/division-service-grpc:latest-interfaces');
  });

  it('remove service without cleanup', async () => {
    graph.removeNode('architect/subtraction-service-rest/service:latest', false);
    expect(graph.nodes).lengthOf(6);
  });
});
