import { expect } from '@oclif/test';
import axios from 'axios';
import path from 'path';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyGraph from '../../src/common/dependency-manager/local-graph';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { DependencyParameter, ServiceNode, ValueFromParameter } from '../../src/dependency-manager/src';

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
  });

  it('value no override datastore', async () => {
    const addition_db_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest.primary')!;
    expect(addition_db_node.parameters.POSTGRES_DB).eq('addition_service');
  });

  it('valueFrom no override', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest')!;
    expect(addition_node.parameters.DB_PRIMARY_USER).eq('postgres');
  });

  it('valueFrom override valueFrom', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest')! as ServiceNode;
    expect((addition_node.service_config.getParameters().DB_PRIMARY_HOST.default as ValueFromParameter<DependencyParameter>).valueFrom.value).eq('$HOST');
    expect((addition_node.node_config.getParameters().DB_PRIMARY_HOST.default as ValueFromParameter<DependencyParameter>).valueFrom.value).eq('postgres://dev:dev@$HOST:$PORT/sponsored-products_development');
    expect(addition_node.parameters.DB_PRIMARY_HOST).eq('postgres://dev:dev@architect.addition-service-rest.latest.primary:5432/sponsored-products_development');
  });

  it('value override valueFrom', async () => {
    const addition_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest')!;
    expect(addition_node.parameters.DB_PRIMARY_PORT).eq(5432);
  });

  it('global value override', async () => {
    const division_node = graph.nodes.find((node) => node.ref === 'architect/division-service-grpc:latest')!;
    expect(division_node.parameters.SUBTRACTION_SERVICE_ADDRESS).eq('global');
  });

  it('global value override datastore', async () => {
    const addition_db_node = graph.nodes.find((node) => node.ref === 'architect/addition-service-rest:latest.primary')!;
    expect(addition_db_node.parameters.POSTGRES_PASSWORD).eq('global');
  });
});
