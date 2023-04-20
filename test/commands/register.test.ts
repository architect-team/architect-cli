import { expect } from 'chai';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import sinon, { SinonStub } from 'sinon';
import untildify from 'untildify';
import { ServiceSpec, TaskSpec, validateSpec } from '../../src';
import ComponentRegister from '../../src/commands/register';
import { DockerUtils } from '../../src/common/docker';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';
import DockerBuildXUtils from '../../src/common/docker/buildx.utils';
import { DockerHelper } from '../../src/common/docker/helper';
import PluginManager from '../../src/common/plugins/plugin-manager';
import BuildPackUtils from '../../src/common/utils/buildpack';
import { IF_EXPRESSION_REGEX } from '../../src/dependency-manager/spec/utils/interpolation';
import { getMockComponentContextPath, getMockComponentFilePath, MockArchitectApi, ReplyCallback } from '../utils/mocks';

describe('register', function () {
  const mock_account_response = {
    created_at: '2020-06-02T15:33:27.870Z',
    updated_at: '2020-06-02T15:33:27.870Z',
    deleted_at: null,
    id: 'ba440d39-97d9-43c3-9f1a-a9a69adb2a41',
    name: 'examples',
    display_name: null,
    description: '',
    location: null,
    website: null,
    default_user_id: null,
  };

  const mock_architect_uppercase_account_response = {
    ...mock_account_response,
    name: 'MY-ACCOUNT',
  };

  const database_seeding_component_version = { component: { name: 'database-seeding' }, tag: '1.0.0' };
  const database_seeding_component_version_latest = { component: { name: 'database-seeding' }, tag: 'latest' };
  const database_seeding_component_version_ephemeral = { component: { name: 'database-seeding' }, tag: 'architect.environment.test-env' };
  const react_app_component_version_latest = { component: { name: 'react-app' }, tag: 'latest' };
  const superset_component_version = { component: { name: 'superset' }, tag: '1.0.0' };

  new MockArchitectApi()
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(ComponentRegister, 'registerComponent', sinon.stub().returns({}))
    .command(['register', '-a', 'examples'])
    .catch(e => {
      expect(e.message).contains(path.resolve(untildify('./architect.yml')));
    })
    .it('expect default project path to be ./architect.yml if not provided');

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { body:
      (body) => {
        const text_file = fs.readFileSync('test/mocks/superset/filedata.txt');
        expect(body.config.services['stateful-api'].environment.FILE_DATA).to.eq(text_file.toString().trim());
        return body;
      }
    })
    .getTests()
    .stub(ComponentRegister.prototype, 'uploadVolume', sinon.stub().returns({}))
    .command(['register', 'test/mocks/superset/architect.yml', '-a', 'examples'])
    .it('test file: replacement', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', sinon.stub().returns([]))
    .command(['register', getMockComponentFilePath('hello-world'), '-t', '1.0.0', '--architecture', 'amd64', '--architecture', 'arm64v8', '--architecture', 'windows-amd64', '-a', 'examples'])
    .it('register component with architecture flag', ctx => {
      const convert_to_buildx_platforms = DockerBuildXUtils.convertToBuildxPlatforms as SinonStub;
      expect(convert_to_buildx_platforms.calledOnce).true;
      expect(convert_to_buildx_platforms.args[0][0]).to.deep.eq(['amd64', 'arm64v8', 'windows-amd64']);
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', sinon.stub().throws(new Error('Some internal docker build exception')))
    .command(['register', getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '--architecture', 'incorrect', '-a', 'examples'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('Some internal docker build exception');
    })
    .it('register component with architecture flag failed');

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { response:
      (uri: string, body: Record<string, any>, cb: ReplyCallback) => {
        expect(validateSpec(body.config)).to.have.lengthOf(0);
        for (const [service_name, service] of Object.entries(body.config.services) as [string, ServiceSpec][]) {
          if (IF_EXPRESSION_REGEX.test(service_name)) {
            continue;
          }
          expect(service.image).not.undefined;
        }
        for (const [task_name, task] of Object.entries(body.config.tasks || []) as [string, TaskSpec][]) {
          if (IF_EXPRESSION_REGEX.test(task_name)) {
            continue;
          }
          expect(task.image).not.undefined;
        }
        cb(null, body);
      }
    })
    .getComponentVersionByTagAndAccountName(mock_account_response, superset_component_version)
    .getTests()
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .stub(fs, 'move', sinon.stub())
    .stub(ComponentRegister.prototype, 'uploadVolume', sinon.stub().returns({}))
    .command(['register', 'test/mocks/superset/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register superset', async ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
      /*
      const writeCompose = DockerComposeUtils.writeCompose as sinon.SinonStub;
      const compose_contents = yaml.load(writeCompose.firstCall.args[1]) as DockerComposeTemplate;

      const compose_path = `${TMP_DIR}/docker-compose.yml`;
      try {
        fs.ensureFileSync(compose_path);
        fs.writeFileSync(compose_path, yaml.dump(compose_contents));
        const cmd = execa.commandSync('docker compose config --quiet', { cwd: TMP_DIR });
        expect(cmd.stdout).to.be.eq('');
        expect(cmd.exitCode).to.be.eq(0);
      } finally {
        fs.removeSync(compose_path);
      }
      */
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getComponentVersionByTagAndAccountName(mock_account_response, database_seeding_component_version)
    .getTests()
    .command(['register', getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '-a', 'examples'])
    .it('it reports to the user that the component was registered successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .registerComponentDigest(mock_account_response)
    .getComponentVersionByTagAndAccountName(mock_account_response, superset_component_version)
    .architectRegistryHeadRequest('/v2/examples/superset.services.stateless-app/manifests/1.0.0')
    .architectRegistryHeadRequest('/v2/examples/superset.services.stateful-api/manifests/1.0.0')
    .architectRegistryHeadRequest('/v2/examples/superset.services.stateful-frontend/manifests/1.0.0')
    .architectRegistryHeadRequest('/v2/examples/superset.tasks.curler-build/manifests/1.0.0')
    .getTests()
    .command(['register', 'test/mocks/superset/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('it reports to the user that the superset was registered successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .getEnvironment(mock_account_response, { name: 'test-env'})
    .registerComponentDigest(mock_account_response, { body:
      (body) => {
        expect(body.tag).to.eq('architect.environment.test-env');
        expect(body.config.name).to.eq('database-seeding');
        expect(body.config.services.app.image).to.eq('mock.registry.localhost/examples/database-seeding.services.app@some-digest');
        return body;
      }
    })
    .getComponentVersionByTagAndAccountName(mock_account_response, database_seeding_component_version_ephemeral)
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .command(['register', getMockComponentFilePath('database-seeding'), '-a', 'examples', '-e', 'test-env'])
    .it('registers an ephemeral component with an environment specified', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { body:
      (body) => {
        expect(body.tag).to.eq('1.0.0');
        expect(body.config.name).to.eq('database-seeding');
        expect(body.config.services.app.image).to.eq('mock.registry.localhost/examples/database-seeding.services.app@some-digest');
        return body;
      }
    })
    .getComponentVersionByTagAndAccountName(mock_account_response, database_seeding_component_version)
    .getTests()
    .command(['register', getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '-a', 'examples'])
    .it('it does not call any docker commands if the image is provided', ctx => {
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getComponentVersionByTagAndAccountName(mock_account_response, database_seeding_component_version_latest)
    .getTests()
    .command(['register', getMockComponentFilePath('database-seeding'), '-a', 'examples'])
    .it('it defaults the tag to latest if not supplied', ctx => {
      expect(ctx.stderr).to.contain('Registering component database-seeding:latest with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, {
      response: {
        message: 'Friendly error message from server',
      },
      response_code: 403,
    })
    .getTests()
    .command(['register', getMockComponentFilePath('hello-world'), '-a', 'examples'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('Friendly error message from server');
    })
    .it('rejects with informative error message if account is unavailable');

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { body:
      (body) => {
        expect(body.tag).to.eq('1.0.0');
        expect(body.config.name).to.eq('database-seeding');
        expect(body.config.services.app.image).to.eq('mock.registry.localhost/examples/database-seeding.services.app@some-digest');
        return body;
      }
    })
    .getComponentVersionByTagAndAccountName(mock_account_response, database_seeding_component_version)
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .command(['register', getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '-a', 'examples'])
    .it('gives user feedback while running docker commands', ctx => {
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub().throws(new Error('Some internal docker build exception')))
    .command(['register', getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '-a', 'examples'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(err.message).to.contain('Some internal docker build exception');
    })
    .it('rejects with the original error message if docker buildx inspect fails');

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getComponentVersionByTagAndAccountName(mock_account_response, database_seeding_component_version)
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .command(['register', getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '-a', 'examples'])
    .it('gives user feedback for each component in the environment while running docker commands', ctx => {
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getComponentVersionByTagAndAccountName(mock_account_response, react_app_component_version_latest)
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .command(['register', getMockComponentFilePath('react-app'), '--arg', 'NODE_ENV=dev', '-a', 'examples'])
    .it('override build arg specified in architect.yml', ctx => {
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');

      const writeCompose = DockerComposeUtils.writeCompose as sinon.SinonStub;
      const compose_contents = yaml.load(writeCompose.firstCall.args[1]) as DockerComposeTemplate;

      expect(Object.values(compose_contents.services).map(s => s.image)).to.have.members([
        'mock.registry.localhost/examples/react-app.services.api:latest',
        'mock.registry.localhost/examples/react-app.services.app:latest',
      ]);
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .command(['register', getMockComponentFilePath('database-seeding'), '--arg', 'NODE_ENV=dev', '--arg', 'SSH_PUB_KEY="abc==\ntest.architect.io"', '-a', 'examples'])
    .it('set build arg not specified in architect.yml', ctx => {
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
      expect(compose.firstCall.args[0][7]).to.deep.equal('*.args.SSH_PUB_KEY="abc==\ntest.architect.io"');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .command(['register', '-a', 'examples', getMockComponentFilePath('react-app'), getMockComponentFilePath('database-seeding')])
    .it('register multiple apps at the same time with no tagged versions', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .command(['register', '-t', '1.0.0', '-a', 'examples', getMockComponentFilePath('react-app'), getMockComponentFilePath('database-seeding')])
    .it('register multiple apps at the same time with a shared tagged version', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .command(['register', getMockComponentFilePath('react-app'), getMockComponentFilePath('database-seeding'), '-t', '1.0.0', '-a', 'examples'])
    .it('register multiple apps at the same time with inverse arg sequence', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .command(['register', getMockComponentFilePath('react-app'), '-t', '1.0.0', getMockComponentFilePath('database-seeding'), '-a', 'examples'])
    .it('register multiple apps at the same time with mixed arg sequence', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .command(['register', getMockComponentFilePath('react-app'), '-t', '1.0.0', getMockComponentFilePath('database-seeding'), '--arg', 'NODE_ENV=dev', '-a', 'examples'])
    .it('register multiple apps at the same time with a shared build arg', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
      expect(compose.secondCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .command(['register', '-a', 'examples', getMockComponentFilePath('react-app'), getMockComponentFilePath('react-app'), getMockComponentFilePath('database-seeding'), '--arg', 'NODE_ENV=dev'])
    .it('register multiple apps at the same time will only register unique component paths', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
      expect(compose.secondCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
      expect(compose.thirdCall).null;
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .command(['register', '-a', 'examples', getMockComponentFilePath('react-app'), `${getMockComponentContextPath('react-app')}/../../mocks/examples/react-app.architect.yml`, getMockComponentFilePath('database-seeding'), '--arg', 'NODE_ENV=dev'])
    .it('register multiple apps at the same time will only register only unique component paths if relative pathing is provided', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
      expect(compose.secondCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
      expect(compose.thirdCall).null;
    });

  new MockArchitectApi()
    .getAccount(mock_account_response, { times: 2 })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response, { times: 2 })
    .getTests()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .command(['register', '-a', 'examples', getMockComponentFilePath('react-app'), getMockComponentFilePath('database-seeding'), '--arg', 'NODE_ENV=dev'])
    .it('register multiple apps at the same time will register and only use build args if applicable', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component database-seeding:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal('*.args.NODE_ENV=dev');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getTests()
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .command(['register', 'test/mocks/buildpack/buildpack-architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register with buildpack set to true override Dockerfile', ctx => {
      expect(ctx.stderr).to.contain('Registering component hello-world:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');

      // Since the image of the service is built from buildpack, docker buildx is not called.
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(0);
      expect(compose.firstCall).null;
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(BuildPackUtils, 'build', sinon.stub())
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stub(DockerHelper, 'composeVersion', sinon.stub().returns(true))
    .stub(DockerHelper, 'buildXVersion', sinon.stub().returns(true))
    .command(['register', 'test/mocks/buildpack/buildpack-dockerfile-architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register with buildpack and dockerfile services', ctx => {
      const buildpack = BuildPackUtils.build as sinon.SinonStub;
      expect(buildpack.args.toString()).to.equal(`${path.normalize('test/plugins')},hello-world--buildpack-api,,${path.join(path.resolve('test/integration'), './hello-world/')}`);
      expect(buildpack.callCount).to.eq(1);

      expect(ctx.stderr).to.contain('Registering component hello-world:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerUtils, 'doesDockerfileExist', sinon.stub().callsFake(DockerUtils.doesDockerfileExist)) // override global stub
    .command(['register', 'test/mocks/register/nonexistence-dockerfile-architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .catch(e => {
      expect(e.message).contains(`${path.resolve('./test/integration/hello-world/nonexistent-dockerfile')} does not exist. Please verify the correct context and/or dockerfile were given.`);
    })
    .it('fail to register with a dockerfile that does not exist');

  new MockArchitectApi()
    .getAccount({ name: 'my-account' }, { response: mock_architect_uppercase_account_response })
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', sinon.stub().returns([]))
    .command(['register', getMockComponentFilePath('hello-world'), '-t', '1.0.0', '-a', 'MY-ACCOUNT'])
    .it('register component to account with name consists of uppercase letters', ctx => {
      const convert_to_buildx_platforms = DockerBuildXUtils.convertToBuildxPlatforms as SinonStub;
      expect(convert_to_buildx_platforms.calledOnce).true;
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  new MockArchitectApi()
    .getAccount(mock_account_response)
    .architectRegistryHeadRequest()
    .registerComponentDigest(mock_account_response)
    .getTests()
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', sinon.stub().returns([]))
    .command(['register', 'test/mocks/deprecations/liveness-probe-path-port.architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('warn when register component with liveness_probe path and port', ctx => {
      expect(ctx.stdout).to.contain(`Deprecated warnings: The liveness probe 'path' and 'port' will no longer be supported`);
      expect(ctx.stdout).to.contain('Successfully registered component');
    });
});
