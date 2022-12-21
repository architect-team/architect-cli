import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import { resourceRefToNodeRef, ServiceNode, ValidationErrors } from '../../src';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';

describe('Service-level secrets', () => {

  it('implied secret/environment variable with asterisk-targeted secret', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { '*': { IMPLIED_SECRET: 'secret_value' } });
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
  });

  it('implied secret/environment variable with component-targeted secret', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { 'hello-world': { IMPLIED_SECRET: 'secret_value' } });
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
  });

  it('optional environment variable with null passed in as the value', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NULL:
            required: false
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { '*': { NULL: null } });
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({});
  });

  it('optional environment variable with no value passed in', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NULL:
            required: false
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({});
  });

  it('optional environment variable with value passed in', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          VALUE:
            required: false
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { '*': { VALUE: 'secret_value' } });
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ VALUE: 'secret_value' });
  });

  it('required environment variable not included', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NOT_NULL:
            required: true
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });

    let err;
    try {
      await manager.getGraph([
        await manager.loadComponentSpec('hello-world'),
      ]);
    } catch (e: any) {
      err = e;
    }

    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(errors[0].path).eq(`services.api.environment.NOT_NULL`);
    expect(errors[0].message).includes(`Required service-level secret 'NOT_NULL' was not provided`);
    expect(errors[0].start?.row).eq(10);
    expect(errors[0].start?.column).eq(11);
    expect(errors[0].end?.row).eq(10);
    expect(errors[0].end?.column).eq(19);
    // expect(process.exitCode).eq(1); // TODO: why is this undefined?
  });

  it('required environment variable included', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          NOT_NULL:
            required: true
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { '*': { NOT_NULL: 'actual_value' } });
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ NOT_NULL: 'actual_value' });
  });

  it('default environment variable', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          DEFAULT:
            default: default_value
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ DEFAULT: 'default_value' });
  });

  it('default environment variable as top-level secret interpolation', async () => {
    const component_config = `
    name: hello-world

    secrets:
      top_level_secret:
        required: true

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          TOP_LEVEL_SECRET:
            default: \${{ secrets.top_level_secret }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { '*': { top_level_secret: 'top_level_value' }});
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({ TOP_LEVEL_SECRET: 'top_level_value' });
  });

  it('default environment variable and top-level secret with the same key resolve properly', async () => {
    const component_config = `
    name: hello-world

    secrets:
      DEFAULT_SECRET:
        default: top_level_default

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          DEFAULT_SECRET:
            default: environment_level_default
          DEFAULT_SECRET_INTERPOLATED:
            default: \${{ secrets.DEFAULT_SECRET }}
    `

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ]);
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(node.config.environment).to.deep.eq({
      DEFAULT_SECRET: 'environment_level_default' ,
      DEFAULT_SECRET_INTERPOLATED: 'top_level_default',
    });
  });
});
