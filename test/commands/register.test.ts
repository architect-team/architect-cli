import { expect } from 'chai';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import sinon, { SinonSpy, SinonStub } from 'sinon';
import untildify from 'untildify';
import { ServiceSpec, TaskSpec, validateSpec } from '../../src';
import AccountUtils from '../../src/architect/account/account.utils';
import ComponentRegister from '../../src/commands/register';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import DockerComposeTemplate from '../../src/common/docker-compose/template';
import DockerBuildXUtils from '../../src/common/docker/buildx.utils';
import PluginManager from '../../src/common/plugins/plugin-manager';
import { IF_EXPRESSION_REGEX } from '../../src/dependency-manager/spec/utils/interpolation';
import { mockArchitectAuth, MOCK_API_HOST, MOCK_REGISTRY_HOST } from '../utils/mocks';

describe('register', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const mock_account_response = {
    created_at: "2020-06-02T15:33:27.870Z",
    updated_at: "2020-06-02T15:33:27.870Z",
    deleted_at: null,
    id: "ba440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples",
    display_name: null,
    description: "",
    location: null,
    website: null,
    is_public: false,
    default_user_id: null,
  };

  const mock_architect_account_response = {
    ...mock_account_response,
    name: 'architect',
  };

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(ComponentRegister, 'registerComponent', sinon.stub().returns({}))
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-a', 'examples'])
    .catch(e => {
      expect(e.message).contains(path.resolve(untildify('./architect.yml')));
    })
    .it('expect default project path to be ./architect.yml if not provided');

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        const text_file = fs.readFileSync('test/mocks/superset/filedata.txt');
        expect(body.config.services['stateful-api'].environment.FILE_DATA).to.eq(text_file.toString().trim());
        return body;
      })
      .reply(200, {})
    )
    .stub(ComponentRegister.prototype, 'uploadVolume', sinon.stub().returns({}))
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'test/mocks/superset/architect.yml', '-a', 'examples'])
    .it('test file: replacement', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .stub(AccountUtils, 'isValidAccount', sinon.stub().returns(false))
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', sinon.stub().returns([]))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200))
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/hello-world/architect.yml', '-t', '1.0.0', '--architecture', 'amd64', '--architecture', 'arm64v8', '--architecture', 'windows-amd64', '-a', 'examples'])
    .it('register component with architecture flag', ctx => {
      const convert_to_buildx_platforms = DockerBuildXUtils.convertToBuildxPlatforms as SinonStub;
      expect(convert_to_buildx_platforms.calledOnce).true;
      expect(convert_to_buildx_platforms.args[0][0]).to.deep.eq(['amd64', 'arm64v8', 'windows-amd64']);
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .stub(DockerBuildXUtils, 'convertToBuildxPlatforms', sinon.stub().throws(new Error('Some internal docker build exception')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/database-seeding/architect.yml', '-t', '1.0.0', '--architecture', 'incorrect', '-a', 'examples'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('Some internal docker build exception');
    })
    .it('register component with architecture flag failed');

  mockArchitectAuth()
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .stub(fs, 'move', sinon.stub())
    .stub(ComponentRegister.prototype, 'uploadVolume', sinon.stub().returns({}))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, (uri, body: any, cb) => {
        expect(validateSpec(body.config)).to.have.lengthOf(0);
        for (const [service_name, service] of Object.entries(body.config.services) as [string, ServiceSpec][]) {
          if (IF_EXPRESSION_REGEX.test(service_name)) { continue; }
          expect(service.image).not.undefined;
        }
        for (const [task_name, task] of Object.entries(body.config.tasks || []) as [string, TaskSpec][]) {
          if (IF_EXPRESSION_REGEX.test(task_name)) { continue; }
          expect(task.image).not.undefined;
        }
        cb(null, body);
      })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/superset/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
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

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, (uri, body: any, cb) => {
        const contents = yaml.load(fs.readFileSync('examples/gcp-pubsub/pubsub/architect.yml').toString());
        expect(body.config).to.deep.equal(contents);
        expect(validateSpec(body.config)).to.have.lengthOf(0);
        cb(null, body);
      })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/gcp-pubsub/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/gcp-pubsub/pubsub/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('it reports to the user that the component was registered successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200)
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/superset/versions/1.0.0`)
      .reply(200)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .head(`/v2/examples/superset.services.stateless-app/manifests/1.0.0`)
      .reply(200)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .head(`/v2/examples/superset.services.stateful-api/manifests/1.0.0`)
      .reply(200)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .head(`/v2/examples/superset.services.stateful-frontend/manifests/1.0.0`)
      .reply(200)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .head(`/v2/examples/superset.tasks.curler-build/manifests/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'test/mocks/superset/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('it reports to the user that the superset was registered successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, (uri, body: any, cb) => {
        const contents = yaml.load(fs.readFileSync('examples/gcp-pubsub/pubsub/architect.yml').toString());
        expect(body.config).to.deep.equal(contents);
        expect(validateSpec(body.config)).to.have.lengthOf(0);
        cb(null, body);
      })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${mock_account_response.id}/environments/test-env`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/gcp-pubsub/pubsub/architect.yml', '-a', 'examples', '-e', 'test-env'])
    .it('registers an ephemeral component with an environment specified', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0');
        expect(body.config.name).to.eq('gcp-pubsub');
        expect(body.config.services.pubsub.image).to.eq('gcr.io/google.com/cloudsdktool/cloud-sdk:emulators');
        return body;
      })
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/gcp-pubsub/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/gcp-pubsub/pubsub/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('it does not call any docker commands if the image is provided', ctx => {
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/gcp-pubsub/versions/latest`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/gcp-pubsub/pubsub/architect.yml', '-a', 'examples'])
    .it('it defaults the tag to latest if not supplied', ctx => {
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:latest with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .stub(AccountUtils, 'isValidAccount', sinon.stub().returns(false))
    .nock(MOCK_API_HOST, api => api
      .get('/accounts/examples')
      .reply(403, {
        message: 'Friendly error message from server',
      })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/hello-world/architect.yml', '-a', 'examples'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(`${err}`).to.contain('Friendly error message from server');
    })
    .it('rejects with informative error message if account is unavailable');

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0');
        expect(body.config.name).to.eq('database-seeding');
        expect(body.config.services.app.image).to.eq('mock.registry.localhost/examples/database-seeding.services.app@some-digest');
        return body;
      })
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/database-seeding/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/database-seeding/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('gives user feedback while running docker commands', ctx => {
      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub().throws(new Error('Some internal docker build exception')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/database-seeding/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .catch(err => {
      expect(process.exitCode).eq(1);
      expect(err.message).to.contain('Some internal docker build exception');
    })
    .it('rejects with the original error message if docker buildx inspect fails');

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/stateless-component/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/stateless-component/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('gives user feedback for each component in the environment while running docker commands', ctx => {
      expect(ctx.stderr).to.contain('Registering component stateless-component:1.0.0 with Architect Cloud');
    });

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/react-app/versions/latest`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/react-app/architect.yml', '--arg', 'NODE_ENV=dev', '-a', 'examples'])
    .it('override build arg specified in architect.yml', ctx => {
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");

      const writeCompose = DockerComposeUtils.writeCompose as sinon.SinonStub;
      const compose_contents = yaml.load(writeCompose.firstCall.args[1]) as DockerComposeTemplate;

      expect(Object.values(compose_contents.services).map(s => s.image)).to.have.members([
        'mock.registry.localhost/examples/react-app.services.api:latest',
        'mock.registry.localhost/examples/react-app.services.app:latest',
      ]);
    });

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/stateful-component/versions/latest`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/stateful-component/architect.yml', '--arg', 'NODE_ENV=dev', '--arg', 'SSH_PUB_KEY="abc==\ntest.architect.io"', '-a', 'examples'])
    .it('set build arg not specified in architect.yml', ctx => {
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.firstCall.args[0][7]).to.deep.equal('*.args.SSH_PUB_KEY="abc==\ntest.architect.io"');
    });

  mockArchitectAuth()
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-a', 'examples', 'examples/react-app/architect.yml', 'examples/gcp-pubsub/pubsub/architect.yml'])
    .it('register multiple apps at the same time with no tagged versions', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-t', '1.0.0', '-a', 'examples', 'examples/react-app/architect.yml', 'examples/gcp-pubsub/pubsub/architect.yml'])
    .it('register multiple apps at the same time with a shared tagged version', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/react-app/architect.yml', 'examples/gcp-pubsub/pubsub/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register multiple apps at the same time with inverse arg sequence', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/react-app/architect.yml', '-t', '1.0.0', 'examples/gcp-pubsub/pubsub/architect.yml', '-a', 'examples'])
    .it('register multiple apps at the same time with mixed arg sequence', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/react-app/architect.yml', '-t', '1.0.0', 'examples/stateful-component/architect.yml', '--arg', 'NODE_ENV=dev', '-a', 'examples'])
    .it('register multiple apps at the same time with a shared build arg', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component stateful-component:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.secondCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
    });

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-a', 'examples', 'examples/react-app/architect.yml', 'examples/react-app/architect.yml', 'examples/stateful-component/architect.yml', '--arg', 'NODE_ENV=dev'])
    .it('register multiple apps at the same time will only register unique component paths', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component stateful-component:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.secondCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.thirdCall).null;
    });

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-a', 'examples', 'examples/react-app/architect.yml', 'examples/../examples/react-app/architect.yml', 'examples/stateful-component/architect.yml', '--arg', 'NODE_ENV=dev'])
    .it('register multiple apps at the same time will only register only unique component paths if relative pathing is provided', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component stateful-component:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.secondCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.thirdCall).null;
    });

  mockArchitectAuth()
    .stub(fs, 'move', sinon.stub())
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .stub(DockerComposeUtils, 'writeCompose', sinon.stub())
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .get(/\/accounts\/examples/)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-a', 'examples', 'examples/react-app/architect.yml', 'examples/gcp-pubsub/pubsub/architect.yml', '--arg', 'NODE_ENV=dev'])
    .it('register multiple apps at the same time will register and only use build args if applicable', ctx => {
      expect(ctx.stderr).to.contain('Registering component react-app:latest with Architect Cloud...... done\n');
      expect(ctx.stderr).to.contain('Registering component gcp-pubsub:latest with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
      expect(compose.firstCall.args[0][5]).to.deep.equal("*.args.NODE_ENV=dev");
      expect(compose.secondCall).null;
    });

  mockArchitectAuth()
    .stub(AccountUtils, 'isValidAccount', sinon.stub().returns(false))
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'test/mocks/register/architect.yml', '-a', 'examples'])
    .it('register with invalid account in architect.yml will use account from command instead', ctx => {
      const is_valid_account = AccountUtils.isValidAccount as SinonSpy;
      expect(is_valid_account.getCalls().length).to.equal(1);
      expect(ctx.stdout).to.contain(`The account name 'invalid-account' was found as part of the component name in your architect.yml file. Either that account does not exist or you do not have permission to access it.`);
      expect(ctx.stdout).to.contain('Successfully registered component');
    });
  
  mockArchitectAuth()
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'test/mocks/buildpack/buildpack-architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register with buildpack set to true override Dockerfile', ctx => {
      expect(ctx.stderr).to.contain('Registering component hello-world-buildpack:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');

      // Since the image of the service is built from the buildpack, docker buildx is not called.
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(0);
      expect(compose.firstCall).null;
    });
  
  mockArchitectAuth()
    .stub(DockerBuildXUtils, 'dockerBuildX', sinon.stub())
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_REGISTRY_HOST, api => api
      .persist()
      .head(/.*/)
      .reply(200, '', { 'docker-content-digest': 'some-digest' })
    )
    .nock(MOCK_API_HOST, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stub(PluginManager, 'getPlugin', sinon.stub().returns({
      build: () => { },
    }))
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'test/mocks/buildpack/buildpack-dockerfile-architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register with buildpack and dockerfile services', ctx => {
      expect(ctx.stderr).to.contain('Registering component hello-world-all:1.0.0 with Architect Cloud...... done\n');
      expect(ctx.stdout).to.contain('Successfully registered component');
      const compose = DockerBuildXUtils.dockerBuildX as sinon.SinonStub;
      expect(compose.callCount).to.eq(1);
    });
});
