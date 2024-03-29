import { expect } from '@oclif/test';
import sinon, { SinonSpy } from 'sinon';
import { ComponentVersionSlugUtils, LivenessProbeConfig, RecursivePartial } from '../../src';
import PipelineUtils from '../../src/architect/pipeline/pipeline.utils';
import Deploy from '../../src/commands/deploy';
import ComponentRegister from '../../src/commands/register';
import DeployUtils from '../../src/common/utils/deploy.utils';
import * as ComponentBuilder from '../../src/dependency-manager/spec/utils/component-builder';
import { app_host } from '../config.json';
import { MockArchitectApi } from '../utils/mocks';

const account = {
  id: 'test-account-id',
  name: 'test-account',
};

const environment = {
  id: 'test-env-id',
  name: 'test-env',
  account,
};

const mock_pipeline = {
  id: 'test-pipeline-id',
  environment: environment
};

const mock_certificates = [
  {
    metadata: {
      labels: {
        'architect.io/component': 'echo',
        'architect.io/component-tag': 'latest',
      },
    },
    dns_names: ['env--foobar', 'app.test-env.examples.arc.test'],
    service_dns_names: ['env--foobar', 'app.test-env.examples.arc.test'],
  }, {
    metadata: {
      labels: {
        'architect.io/component': 'not-echo',
        'architect.io/component-tag': 'not-latestlatest',
      },
    },
    dns_names: ['env--foobar', 'app.doesnt.get.output'],
    service_dns_names: ['env--foobar'],
  },
];

const mock_liveness_probe: RecursivePartial<LivenessProbeConfig> = {
  port: 3000,
  path: '/',
};

const mock_deployments = [
  {
    component_version: {
      config: {
        name: 'hello-world',
        services: {
          app: {
            liveness_probe: mock_liveness_probe,
          },
        },
      },
    },
  },
];

describe('remote deploy environment', function () {
  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .it('Creates a remote deployment when env exists with env and account flags', ctx => {
      expect(ctx.stdout).to.contain('deployed');
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .stub(ComponentRegister.prototype, 'run', sinon.stub().returns(Promise.resolve()))
    .stub(ComponentBuilder, 'buildSpecFromPath', sinon.stub().returns(Promise.resolve()))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--arg', 'NODE_ENV=production', '--auto-approve', 'test/mocks/superset/architect.yml'])
    .it('Creates a remote deployment with env and account flags and a path to a component', ctx => {
      const register_run = ComponentRegister.prototype.run as SinonSpy;
      expect(register_run.getCalls().length).to.equal(1);
      const build_spec = ComponentBuilder.buildSpecFromPath as SinonSpy;
      expect(build_spec.getCalls().length).to.equal(1);
      expect(build_spec.firstCall.args[0]).eq('test/mocks/superset/architect.yml');
      expect(ctx.stdout).to.contain('deployed');
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .stub(ComponentRegister.prototype, 'run', sinon.stub().returns(Promise.resolve()))
    .stub(ComponentBuilder, 'buildSpecFromPath', sinon.stub().returns(Promise.resolve()))
    .stub(ComponentVersionSlugUtils.Validator, 'test', sinon.stub().returns(Promise.resolve()))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'test/mocks/superset/architect.yml', `${account.name}/superset:latest`])
    .it('Creates a remote deployment with env and account flags, a path to a component, and a component version', ctx => {
      expect((ComponentRegister.prototype.run as SinonSpy).getCalls().length).to.equal(1);
      const build_spec = ComponentBuilder.buildSpecFromPath as SinonSpy;
      expect(build_spec.getCalls().length).to.equal(1);
      expect(build_spec.firstCall.args[0]).eq('test/mocks/superset/architect.yml');

      const slug_validator = ComponentVersionSlugUtils.Validator.test as SinonSpy;
      expect(slug_validator.getCalls().length).to.equal(1);
      expect(slug_validator.firstCall.args[0]).eq(`${account.name}/superset:latest`);

      expect(ctx.stdout).to.contain('deployed');
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .it('Remote deployment outputs URLs from for the deployed component and not other components in the same environment', ctx => {
      expect(ctx.stdout).to.contain('app.test-env.examples.arc.test');
      expect(ctx.stdout).to.not.contain('app.doesnt.get.output');
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo'])
    .it('Remote deployment outputs URLs from for the deployed component with no tag and not other components in the same environment', ctx => {
      expect(ctx.stdout).to.contain('app.test-env.examples.arc.test');
      expect(ctx.stdout).to.not.contain('app.doesnt.get.output');
    });

  describe('instance deploys', function () {
    new MockArchitectApi()
      .getAccount(account)
      .getEnvironment(account, environment)
      .deployComponent(environment, mock_pipeline)
      .getEnvironmentCertificates(environment, mock_certificates)
      .approvePipeline(mock_pipeline)
      .pollPipeline(mock_pipeline)
      .getPipelineDeployments(mock_pipeline, [])
      .getTests()
      .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest@tenant-1'])
      .it('Creates a remote deployment when env exists with env and account flags', ctx => {
        expect(ctx.stdout).to.contain('deployed');
      });
  });
});

describe('auto-approve flag with underscore style still works', function () {
  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto_approve', 'echo:latest'])
    .it('works but also emits a deprecation warning', ctx => {
      expect(ctx.stderr).to.contain('Warning: The "auto_approve" flag has been deprecated.');
      expect(ctx.stdout).to.contain('deployed');
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [])
    .getTests()
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto_approve=true', 'echo:latest'])
    .it('works but also emits a deprecation warning 2', ctx => {
      expect(ctx.stderr).to.contain('Warning: The "auto_approve" flag has been deprecated.');
      expect(ctx.stdout).to.contain('deployed');
    });
});

describe('pollPipeline handles failed deployments', () => {
  const randomId = () => (Math.random() + 1).toString(36).substring(2);

  const mock_cluster = {
    id: randomId(),
    name: 'my-mocked-cluster',
    account,
  };
  const failed_pipeline = {
    id: mock_pipeline.id,
    failed_at: (new Date()).toString(),
    environment,
    cluster: mock_cluster,
  };
  const aborted_deployment = {
    id: randomId(),
    aborted_at: (new Date()).toString(),
    pipeline: failed_pipeline,
  };
  const failed_environment_deployment = {
    id: randomId(),
    failed_at: (new Date()).toString(),
    pipeline: {
      ...failed_pipeline,
      cluster: undefined,
    },
  };
  const failed_environment_deployment_2 = {
    ...failed_environment_deployment,
    id: randomId(),
  };
  const failed_cluster_deployment = {
    id: randomId(),
    failed_at: (new Date()).toString(),
    pipeline: {
      ...failed_pipeline,
      environment: undefined,
    },
  };

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [aborted_deployment])
    .getTests()
    .stub(PipelineUtils, 'awaitPipeline', sinon.stub().resolves({ pipeline: failed_pipeline }))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .catch(err => {
      const message = `Deployment ${aborted_deployment.id} was aborted. See the deployment log for more details:`;
      const link = `${app_host}/${account.name}/environments/${aborted_deployment.pipeline.environment.name}/deployments/${aborted_deployment.id}`;
      const expected_error = `${message}\n${link}`;
      expect(err.message).to.equal(expected_error);
    })
    .it('when deployment is aborted it prints useful error with expected url');

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [failed_environment_deployment])
    .getTests()
    .stub(PipelineUtils, 'awaitPipeline', sinon.stub().resolves({ pipeline: failed_pipeline }))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .catch(err => {
      const message = `Pipeline ${mock_pipeline.id} failed because 1 deployment failed:`;
      const link = `- ${app_host}/${account.name}/environments/${failed_environment_deployment.pipeline.environment!.name}/deployments/${failed_environment_deployment.id}`;
      const expected_error = `${message}\n${link}`;
      expect(err.message).to.equal(expected_error);
    })
    .it('when environment deployment fails it prints useful error with expected url');

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [failed_cluster_deployment])
    .getTests()
    .stub(PipelineUtils, 'awaitPipeline', sinon.stub().resolves({ pipeline: failed_pipeline }))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .catch(err => {
      const message = `Pipeline ${mock_pipeline.id} failed because 1 deployment failed:`;
      const link = `- ${app_host}/${account.name}/clusters/${failed_cluster_deployment.pipeline.cluster!.name}`;
      const expected_error = `${message}\n${link}`;
      expect(err.message).to.equal(expected_error);
    })
    .it('when pipeline deployment fails it prints useful error with expected url');

    new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, [failed_environment_deployment, failed_environment_deployment_2])
    .getTests()
    .stub(PipelineUtils, 'awaitPipeline', sinon.stub().resolves({ pipeline: failed_pipeline }))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .catch(err => {
      const message = `Pipeline ${mock_pipeline.id} failed because 2 deployments failed:`;
      const link1 = `- ${app_host}/${account.name}/environments/${failed_environment_deployment.pipeline.environment.name}/deployments/${failed_environment_deployment.id}`;
      const link2 = `- ${app_host}/${account.name}/environments/${failed_environment_deployment_2.pipeline.environment.name}/deployments/${failed_environment_deployment_2.id}`;
      const expected_error = `${message}\n${link1}\n${link2}`;
      expect(err.message).to.equal(expected_error);
    })
    .it('when multiple pipeline deployments fail it prints useful error with expected urls');

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .approvePipeline(mock_pipeline)
    .getTests()
    .stub(PipelineUtils, 'awaitPipeline', sinon.stub().resolves({ pipeline: failed_pipeline }))
    .stub(PipelineUtils, 'awaitPipeline', sinon.stub().resolves({ poll_timeout: true }))
    .stub(Deploy.prototype, 'warn', sinon.fake.returns(null))
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .catch(err => {
      const expected_error = 'Timeout while polling the pipeline';
      expect(err.message).to.equal(expected_error);
    })
    .it('when polling times out it prints expected message');
});

describe('deployment secrets', function () {
  const wildcard_secrets = {
    'echo': {
      'a_required_key': 'some_value',
      'api_port': 3000,
      'one_more_required_secret': 'one_more_value',
    },
    '*': {
      'another_required_key': 'required_value'
    }
  }
  const dotenv_wildcard_secrets = {
    '*': {
      'another_required_key': 'required_value',
      'a_required_key': 'some_value',
      'api_port': 3000,
      'one_more_required_secret': 'one_more_value'
    }
  };

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline, { body:
      (body) => {
        expect(body.values['*'].app_replicas).to.eq(4);
        return body;
      }
    })
    .getTests()
    .stub(Deploy.prototype, 'warn', sinon.fake.returns(null))
    .stub(Deploy.prototype, 'approvePipeline', sinon.stub().returns(Promise.resolve()))
    .command(['deploy', '-e', environment.name, '-a', account.name, 'echo:latest', '--secret', 'app_replicas=4'])
    .it('a numeric secret is passed to the API as a number and not converted to a string', ctx => {
      expect((Deploy.prototype.approvePipeline as SinonSpy).getCalls().length).to.equal(1);
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline, { body:
      (body) => {
        expect(body.values['*'].test_secret).to.eq('test');
        expect(body.values['*'].another_secret).to.eq('another_test');
        return body;
      }
    })
    .getTests()
    .stub(Deploy.prototype, 'warn', sinon.fake.returns(null))
    .stub(Deploy.prototype, 'approvePipeline', sinon.stub().returns(Promise.resolve()))
    .command(['deploy', '-e', environment.name, '-a', account.name, 'echo:latest', '--secret', 'test_secret=test', '--secret', 'another_secret=another_test'])
    .it('passing multiple secrets inline', ctx => {
      expect((Deploy.prototype.approvePipeline as SinonSpy).getCalls().length).to.equal(1);
    });

  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline, { body:
      (body) => {
        expect(body.values['*'].another_required_key).to.eq('required_value');
        expect(body.values.echo.a_required_key).to.eq('some_value');
        expect(body.values.echo.api_port).to.eq(3000);
        expect(body.values.echo.one_more_required_secret).to.eq('one_more_value');
        return body;
      }
    })
    .getTests()
    .stub(Deploy.prototype, 'warn', sinon.fake.returns(null))
    .stub(Deploy.prototype, 'approvePipeline', sinon.stub().returns(Promise.resolve()))
    .stub(DeployUtils, 'readSecretsFile', () => {
      return wildcard_secrets;
    })
    .command(['deploy', '-e', environment.name, '-a', account.name, 'echo:latest', '--secret-file', './examples/echo/secrets.yml'])
    .it('passing a secrets file', ctx => {
      expect((Deploy.prototype.approvePipeline as SinonSpy).getCalls().length).to.equal(1);
    });


  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline, { body:
      (body) => {
        expect(body.values['*'].another_required_key).to.eq('required_value');
        expect(body.values['*'].a_required_key).to.eq('some_value');
        expect(body.values['*'].api_port).to.eq(3000);
        expect(body.values['*'].one_more_required_secret).to.eq('one_more_value');
        return body;
      }
    })
    .getTests()
    .stub(Deploy.prototype, 'warn', sinon.fake.returns(null))
    .stub(Deploy.prototype, 'approvePipeline', sinon.stub().returns(Promise.resolve()))
    .stub(DeployUtils, 'readDotEnvSecretsFile', () => {
      return dotenv_wildcard_secrets;
    })
    .command(['deploy', '-e', environment.name, '-a', account.name, 'echo:latest', '--secret-file', './examples/echo/.env'])
    .it('passing a dotenv secrets file', ctx => {
      expect((Deploy.prototype.approvePipeline as SinonSpy).getCalls().length).to.equal(1);
    });
});

describe('liveness_probe deprecation warning', function () {
  new MockArchitectApi()
    .getAccount(account)
    .getEnvironment(account, environment)
    .deployComponent(environment, mock_pipeline)
    .getEnvironmentCertificates(environment, mock_certificates)
    .approvePipeline(mock_pipeline)
    .pollPipeline(mock_pipeline)
    .getPipelineDeployments(mock_pipeline, mock_deployments)
    .getTests()
    .command(['deploy', '-e', environment.name, '-a', account.name, '--auto-approve', 'echo:latest'])
    .it('warn when liveness_probe path and port are found in deployments', ctx => {
      expect(ctx.stdout).to.contain(`Deprecation warning: The liveness probe 'path' and 'port' will no longer be supported`);
      expect(ctx.stdout).to.contain('deployed');
    });
});
