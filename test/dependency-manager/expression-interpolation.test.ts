import { expect } from '@oclif/test';
import axios from 'axios';
import mock_fs from 'mock-fs';
import moxios from 'moxios';
import sinon from 'sinon';
import Build from '../../src/commands/build';
import LocalDependencyManager from '../../src/common/dependency-manager/local-manager';
import { ServiceNode } from '../../src/dependency-manager/src';
import { ExpressionInterpolator } from '../../src/dependency-manager/src/utils/interpolation/expression-interpolator';
import { EnvironmentInterpolationContext } from '../../src/dependency-manager/src/utils/interpolation/interpolation-context';

describe('expression-interpolation', function () {
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

  it('loadParameters-with-expressions', async () => {
    const frontend_config = {
      name: 'architect/cloud',
      interfaces: {
        app: '${ parameters.APP_PORT }'
      },
      dependencies: {
        'architect/cloud-api': 'v1'
      },
      parameters: {
        APP_PORT: 8080,
        DB_USER: {
          value_from: {
            datastore: 'db',
            value: '$DB_USER'
          }
        },
        DEP_DB_USER: "${ dependencies['architect/cloud-api'].parameters.DB_USER }",
        lower_dep_ADMIN_PORT: "${ dependencies['architect/cloud-api'].interfaces.admin.port }",
      },
      datastores: {
        db: {
          image: 'postgres:11',
          port: 5432,
          parameters: {
            DB_USER: 'root'
          }
        }
      }
    };

    moxios.stubRequest(`/accounts/architect/services/cloud/versions/v1`, {
      status: 200,
      response: { tag: 'v1', config: frontend_config, service: { url: 'architect/cloud:v1' } },
    });

    const backend_config = {
      name: 'architect/cloud-api',
      interfaces: {
        api: 8080,
        admin: 8081,
        primary: 8082,
      },
      parameters: {
        DB_USER: '${ dependencies.primary.parameters.DB_USER }',
      },
      dependencies: {
        primary: {
          image: 'postgres:11',
          port: 5432,
          parameters: {
            DB_USER: 'dep-root'
          }
        }
      }
    };

    moxios.stubRequest(`/accounts/architect/services/cloud-api/versions/v1`, {
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

    const default_keys = [
      'EXTERNAL_HOST',
      'INTERNAL_HOST',
      'HOST',
      'EXTERNAL_PORT',
      'INTERNAL_PORT',
      'PORT',
      'EXTERNAL_PROTOCOL',
      'INTERNAL_PROTOCOL',
      'EXTERNAL_URL',
      'INTERNAL_URL',
    ];

    const manager = await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true);
    const graph = manager.graph;
    const frontend_node = graph.nodes[0] as ServiceNode;
    const backend_node = graph.nodes[2] as ServiceNode;
    const backend_datastore_node = graph.nodes[1] as ServiceNode;
    expect(Object.keys(frontend_node.parameters)).members(['APP_PORT', 'DB_USER', 'DEP_DB_USER', 'lower_dep_ADMIN_PORT', ...default_keys]);
    expect(frontend_node.interfaces.app.port).eq(8080);
    expect(frontend_node.parameters['APP_PORT']).eq(8080);
    expect(frontend_node.parameters['DB_USER']).eq('root');
    expect(frontend_node.parameters['DEP_DB_USER']).eq('dep-root');
    expect(frontend_node.parameters['lower_dep_ADMIN_PORT']).eq('8081');
    expect(backend_node.parameters['PRIMARY_PORT']).eq('8082');
    expect(backend_datastore_node.parameters['PORT']).eq('5432');
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
        PARAM_A: "${ parameters.PARAM_B }",
        PARAM_B: "${ parameters.PARAM_A }",
      }
    };

    moxios.stubRequest(`/accounts/architect/services/cloud/versions/v1`, {
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
    await LocalDependencyManager.createFromPath(axios.create(), '/stack/arc.env.json', undefined, true)
      .catch(error => {
        expect(error.toString()).to.contain('Stack Overflow Error: You might have a circular reference in your ServiceConfig expression stack');
        const duration = Date.now() - start_time;
        expect(duration).to.be.lessThan(500); // the worst case scenario (stack overflow) shouldn't take longer than half a second
      });
  });

  it('ExpressionInterpolator.interpolateString works in happy path', async () => {
    const data_context: EnvironmentInterpolationContext = {
      service: {
        parameters: {
          PARAM_A: 'VALUE_A',
        },
        interfaces: {},
      }
    };

    const expression = '${ service.parameters.PARAM_A }';
    const result = ExpressionInterpolator.interpolateString(expression, data_context);
    expect(result).to.equal('VALUE_A');
  });

  it('ExpressionInterpolator.interpolateString observes dollar syntax and not default syntax', async () => {
    const data_context: EnvironmentInterpolationContext = {
      service: {
        parameters: {
          PARAM_A: 'VALUE_A',
        },
        interfaces: {},
      }
    };

    const expression = '{{ service.parameters.PARAM_A }}';
    const result = ExpressionInterpolator.interpolateString(expression, data_context);
    expect(result).to.equal('{{ service.parameters.PARAM_A }}');
  });

  //TODO:77: this test should start failing when we add validation
  it('ExpressionInterpolator.interpolateString fails silently if expression resolves to empty string', async () => {
    const data_context: EnvironmentInterpolationContext = {
      service: {
        parameters: {
          PARAM_A: 'VALUE_A',
        },
        interfaces: {},
      }
    };

    const expression = '${ service.parameters.PARAM_B }';
    const result = ExpressionInterpolator.interpolateString(expression, data_context);
    expect(result).to.equal('');
  });

  //TODO:77: this test should start failing when we add validation
  it('ExpressionInterpolator.interpolateString fails silently if expression refers to invalid object', async () => {
    const data_context: EnvironmentInterpolationContext = {
      service: {
        parameters: {
          PARAM_A: 'VALUE_A',
        },
        interfaces: {},
      }
    };

    const expression = '${ service.invalidobject.PARAM_A }';
    const result = ExpressionInterpolator.interpolateString(expression, data_context);
    expect(result).to.equal('');
  });

  //TODO:77: this test should NOT fail when we add validation
  it('ExpressionInterpolator.interpolateString works if expression references valid empty string', async () => {
    const data_context: EnvironmentInterpolationContext = {
      service: {
        parameters: {
          PARAM_A: 'VALUE_A',
          EMPTY_STRING_PARAM: '',
        },
        interfaces: {},
      }
    };

    const expression = '${ service.parameters.EMPTY_STRING_PARAM }';
    const result = ExpressionInterpolator.interpolateString(expression, data_context);
    expect(result).to.equal('');
  });

  it('ExpressionInterpolator.namespaceExpressions replaces dependencies with correct node_ref in dot notation', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = '${ dependencies.child1.parameters.PARAM_A }';
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_child1_latest.parameters.PARAM_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions replaces dependencies with correct node_ref in bracket notation', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "${ dependencies['child1'].parameters.PARAM_A }";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_child1_latest.parameters.PARAM_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions namespaces parameters with node_ref', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "${ parameters.PARAM_A }";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_serviceA_latest.parameters.PARAM_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions namespaces interfaces with node_ref', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "${ interfaces.INTERFACE_A }";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_serviceA_latest.interfaces.INTERFACE_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions namespaces interfaces with node_ref', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "${ interfaces.INTERFACE_A }";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_serviceA_latest.interfaces.INTERFACE_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions namespaces multiple references in the same expression', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "${ interfaces.INTERFACE_A } other text ${ dependencies['child1'].parameters.PARAM_A }";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_serviceA_latest.interfaces.INTERFACE_A } other text ${ account_child1_latest.parameters.PARAM_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions namespaces references to different dependencies in the same expression', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "${ dependencies['child1'].parameters.PARAM_A } other text ${ dependencies.child2.parameters.PARAM_A }";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal('${ account_child1_latest.parameters.PARAM_A } other text ${ account_child2_latest.parameters.PARAM_A }');
  });

  it('ExpressionInterpolator.namespaceExpressions does not accidentally match other uses of keywords', async () => {
    const node_ref = 'account_serviceA_latest';
    const friendly_name_map: { [key: string]: string } = {
      child1: 'account_child1_latest',
      child2: 'account_child2_latest',
    };

    const expression = "dependencies.notinexpression.shouldnotchange interfaces.text dependencies['plaintext'].noexpression parameters.text";
    const namespaced_expression = ExpressionInterpolator.namespaceExpressions(node_ref, expression, friendly_name_map);
    expect(namespaced_expression).to.equal("dependencies.notinexpression.shouldnotchange interfaces.text dependencies['plaintext'].noexpression parameters.text");
  });
});
