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
    `;

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
    `;

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

  it('implied environment variable, but secret value not provided', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

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
    expect(errors[0].path).eq(`services.api.environment.IMPLIED_SECRET`);
    expect(errors[0].message).includes(`Required service-level secret 'IMPLIED_SECRET' was not provided`);
    expect(errors[0].start?.row).eq(10);
    expect(errors[0].start?.column).eq(11);
    expect(errors[0].end?.row).eq(10);
    expect(errors[0].end?.column).eq(25);
    // expect(process.exitCode).eq(1); // TODO: why is this undefined?
  });

  it('required secret/environment variable with component-targeted secret, but incorrect component target', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          REQUIRED_SECRET:
            required: true
    `;

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
      ], { 'hello-world-incorrect': { REQUIRED_SECRET: 'secret_value' } });
    } catch (e: any) {
      err = e;
    }

    expect(err).instanceOf(ValidationErrors);
    const errors = JSON.parse(err.message);
    expect(errors).lengthOf(1);
    expect(errors[0].path).eq(`services.api.environment.REQUIRED_SECRET`);
    expect(errors[0].message).includes(`Required service-level secret 'REQUIRED_SECRET' was not provided`);
    expect(errors[0].start?.row).eq(10);
    expect(errors[0].start?.column).eq(11);
    expect(errors[0].end?.row).eq(10);
    expect(errors[0].end?.column).eq(26);
    // expect(process.exitCode).eq(1); // TODO: why is this undefined?
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
    `;

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
    `;

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
    `;

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
    `;

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

  it('multiple required environment variables not included', async () => {
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
          NOT_NULL_2:
            required: true
    `;

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
    expect(errors).lengthOf(2);

    expect(errors[0].path).eq(`services.api.environment.NOT_NULL`);
    expect(errors[0].message).includes(`Required service-level secret 'NOT_NULL' was not provided`);
    expect(errors[0].start?.row).eq(10);
    expect(errors[0].start?.column).eq(11);
    expect(errors[0].end?.row).eq(10);
    expect(errors[0].end?.column).eq(19);

    expect(errors[1].path).eq(`services.api.environment.NOT_NULL_2`);
    expect(errors[1].message).includes(`Required service-level secret 'NOT_NULL_2' was not provided`);
    expect(errors[1].start?.row).eq(12);
    expect(errors[1].start?.column).eq(11);
    expect(errors[1].end?.row).eq(12);
    expect(errors[1].end?.column).eq(21);
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
    `;

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
    `;

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
    `;

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
    `;

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

  it('different implied secret/environment variable per service with asterisk-targeted secrets', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET_1:
      app:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET_2:
    `;

    mock_fs({
      '/stack/architect.yml': component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
    ], { '*': { IMPLIED_SECRET_1: 'secret_1', IMPLIED_SECRET_2: 'secret_2' } });
    const api_ref = resourceRefToNodeRef('hello-world.services.api');
    const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(api_node.config.environment).to.deep.eq({ IMPLIED_SECRET_1: 'secret_1' });
    const app_ref = resourceRefToNodeRef('hello-world.services.app');
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.config.environment).to.deep.eq({ IMPLIED_SECRET_2: 'secret_2' });
  });

  it('same implied secret/environment variable for each service with asterisk-targeted secret', async () => {
    const component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
      app:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

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
    const api_node = graph.getNodeByRef(api_ref) as ServiceNode;
    expect(api_node.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
    const app_ref = resourceRefToNodeRef('hello-world.services.app');
    const app_node = graph.getNodeByRef(app_ref) as ServiceNode;
    expect(app_node.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
  });

  it('same implied secret/environment variable for each component with asterisk-targeted secret', async () => {
    const hello_world_component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

    const react_app_component_config = `
    name: react-app

    services:
      api:
        image: heroku/nodejs-react-app
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

    mock_fs({
      '/stack/hello-world/architect.yml': hello_world_component_config,
      '/stack/react-app/architect.yml': react_app_component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/hello-world/architect.yml',
      'react-app': '/stack/react-app/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
      await manager.loadComponentSpec('react-app'),
    ], { '*': { IMPLIED_SECRET: 'secret_value' } });
    const api_ref_hello_world = resourceRefToNodeRef('hello-world.services.api');
    const api_node_hello_world = graph.getNodeByRef(api_ref_hello_world) as ServiceNode;
    expect(api_node_hello_world.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
    const api_ref_react_app = resourceRefToNodeRef('react-app.services.api');
    const api_node_eact_app = graph.getNodeByRef(api_ref_react_app) as ServiceNode;
    expect(api_node_eact_app.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
  });

  it('missing implied secret/environment variable for one component, asterisk-targeted implied secret for the other', async () => {
    const hello_world_component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
            required: false
    `;

    const react_app_component_config = `
    name: react-app

    services:
      api:
        image: heroku/nodejs-react-app
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

    mock_fs({
      '/stack/hello-world/architect.yml': hello_world_component_config,
      '/stack/react-app/architect.yml': react_app_component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/hello-world/architect.yml',
      'react-app': '/stack/react-app/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
      await manager.loadComponentSpec('react-app'),
    ], { 'react-app': { IMPLIED_SECRET: 'secret_value' } });
    const api_ref_hello_world = resourceRefToNodeRef('hello-world.services.api');
    const api_node_hello_world = graph.getNodeByRef(api_ref_hello_world) as ServiceNode;
    expect(api_node_hello_world.config.environment).to.deep.eq({});
    const api_ref_react_app = resourceRefToNodeRef('react-app.services.api');
    const api_node_eact_app = graph.getNodeByRef(api_ref_react_app) as ServiceNode;
    expect(api_node_eact_app.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
  });

  it('implied secret/environment variable for one component, asterisk-targeted interpolation secret for the other', async () => {
    const hello_world_component_config = `
    name: hello-world

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          SAME_SECRET:
    `;

    const react_app_component_config = `
    name: react-app

    secrets:
      SAME_SECRET:
        required: true

    services:
      api:
        image: heroku/nodejs-react-app
        interfaces:
          main: 3000
        environment:
          SAME_SECRET: \${{ secrets.SAME_SECRET }}
    `;

    mock_fs({
      '/stack/hello-world/architect.yml': hello_world_component_config,
      '/stack/react-app/architect.yml': react_app_component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/hello-world/architect.yml',
      'react-app': '/stack/react-app/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
      await manager.loadComponentSpec('react-app'),
    ], { '*': { SAME_SECRET: 'secret_value' } });
    const api_ref_hello_world = resourceRefToNodeRef('hello-world.services.api');
    const api_node_hello_world = graph.getNodeByRef(api_ref_hello_world) as ServiceNode;
    expect(api_node_hello_world.config.environment).to.deep.eq({ SAME_SECRET: 'secret_value' });
    const api_ref_react_app = resourceRefToNodeRef('react-app.services.api');
    const api_node_eact_app = graph.getNodeByRef(api_ref_react_app) as ServiceNode;
    expect(api_node_eact_app.config.environment).to.deep.eq({ SAME_SECRET: 'secret_value' });
  });

  it('same implied secret/environment variable for component and dependency with asterisk-targeted secret', async () => {
    const hello_world_component_config = `
    name: hello-world

    dependencies:
      react-app: latest

    services:
      api:
        image: heroku/nodejs-hello-world
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

    const react_app_component_config = `
    name: react-app

    services:
      api:
        image: heroku/nodejs-react-app
        interfaces:
          main: 3000
        environment:
          IMPLIED_SECRET:
    `;

    mock_fs({
      '/stack/hello-world/architect.yml': hello_world_component_config,
      '/stack/react-app/architect.yml': react_app_component_config,
    });

    const manager = new LocalDependencyManager(axios.create(), 'architect', {
      'hello-world': '/stack/hello-world/architect.yml',
      'react-app': '/stack/react-app/architect.yml',
    });
    const graph = await manager.getGraph([
      await manager.loadComponentSpec('hello-world'),
      await manager.loadComponentSpec('react-app'),
    ], { '*': { IMPLIED_SECRET: 'secret_value' } });
    const api_ref_hello_world = resourceRefToNodeRef('hello-world.services.api');
    const api_node_hello_world = graph.getNodeByRef(api_ref_hello_world) as ServiceNode;
    expect(api_node_hello_world.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
    const api_ref_react_app = resourceRefToNodeRef('react-app.services.api');
    const api_node_eact_app = graph.getNodeByRef(api_ref_react_app) as ServiceNode;
    expect(api_node_eact_app.config.environment).to.deep.eq({ IMPLIED_SECRET: 'secret_value' });
  });
});

// TODO: an implied secret should also be required, if it will follow our existing top-level spec
