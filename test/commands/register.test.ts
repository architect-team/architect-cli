import { expect } from 'chai';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import sinon from 'sinon';
import { DockerComposeUtils } from '../../src/common/docker-compose';
import * as Docker from '../../src/common/utils/docker';
import { ServiceSpec, TaskSpec } from '../../src/dependency-manager/src';
import { validateSpec } from '../../src/dependency-manager/src/spec/utils/spec-validator';
import { mockArchitectAuth, MOCK_API_HOST } from '../utils/mocks';

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
    default_user_id: null
  }

  const mock_architect_account_response = {
    ...mock_account_response,
    name: 'architect'
  }

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0')
        expect(body.config.name).to.eq('fusionauth')
        expect(body.config.services.fusionauth.image).to.eq('fusionauth/fusionauth-app:latest')
        expect(body.config.services.fusionauth.environment.ADMIN_USER_PASSWORD).to.eq('${{ parameters.admin_user_password }}')
        expect(body.config.services.fusionauth.environment.FUSIONAUTH_KICKSTART).to.eq('/usr/local/fusionauth/kickstart.json')

        const config = fs.readFileSync('examples/fusionauth/config/kickstart.json');
        expect(body.config.services.fusionauth.environment.KICKSTART_CONTENTS).to.eq(config.toString().trim());
        return body;
      })
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/fusionauth/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('test file: replacement', ctx => {
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(getDigest.notCalled).to.be.true;

      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, (uri, body: any, cb) => {
        expect(validateSpec(body.config)).to.have.lengthOf(0);
        for (const service of Object.values(body.config.services) as ServiceSpec[]) {
          expect(service.image).not.undefined;
        }
        for (const task of Object.values(body.config.tasks) as TaskSpec[]) {
          expect(task.image).not.undefined;
        }
        cb(null, body)
      })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/superset/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'test/mocks/superset/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('register superset', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, (uri, body: any, cb) => {
        const contents = yaml.load(fs.readFileSync('examples/hello-world/architect.yml').toString());
        expect(body.config).to.deep.equal(contents);
        expect(validateSpec(body.config)).to.have.lengthOf(0);
        cb(null, body)
      })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-world/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/hello-world/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('it reports to the user that the component was registered successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0')
        expect(body.config.name).to.eq('hello-world')
        expect(body.config.services.api.image).to.eq('heroku/nodejs-hello-world')
        return body;
      })
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-world/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/hello-world/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .it('it does not call any docker commands if the image is provided', ctx => {
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(getDigest.notCalled).to.be.true;

      expect(ctx.stderr).to.contain('Registering component hello-world:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-world/versions/latest`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/hello-world/architect.yml', '-a', 'examples'])
    .it('it defaults the tag to latest if not supplied', ctx => {
      expect(ctx.stderr).to.contain('Registering component hello-world:latest with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .nock(MOCK_API_HOST, api => api
      .get('/accounts/examples')
      .reply(403, {
        message: 'Friendly error message from server'
      })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/hello-world/architect.yml', '-a', 'examples'])
    .catch(err => {
      expect(err.message).to.contain('Friendly error message from server')
    })
    .it('rejects with informative error message if account is unavailable');

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0')
        expect(body.config.name).to.eq('database-seeding')
        expect(body.config.services.app.image).to.eq('mock.registry.localhost/examples/database-seeding.services.app@some-digest')
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
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(getDigest.calledOnce).to.be.true;

      expect(ctx.stderr).to.contain('Running `docker inspect` on the given image: mock.registry.localhost/examples/database-seeding.services.app:1.0.0');
      expect(ctx.stdout).to.contain('Image verified');

      expect(ctx.stderr).to.contain('Registering component database-seeding:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub().throws('Some internal docker build exception'))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', 'examples/database-seeding/architect.yml', '-t', '1.0.0', '-a', 'examples'])
    .catch(err => {
      expect(`${err}`).to.contain('Some internal docker build exception')
    })
    .it('rejects with informative error message if docker build fails', ctx => {
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(getDigest.notCalled).to.be.true;

      expect(ctx.stdout).to.contain('Docker build failed. If an image is not specified in your component spec, then a Dockerfile must be present');
    });

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
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
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(getDigest.calledOnce).to.be.true;

      expect(ctx.stderr).to.contain('Running `docker inspect` on the given image: mock.registry.localhost/examples/stateless-component.services.stateless-app:1.0.0');
      expect(ctx.stderr).to.contain('Registering component stateless-component:1.0.0 with Architect Cloud');
    });

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub())
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
      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][4]).to.deep.equal('NODE_ENV=dev');
    });

  mockArchitectAuth
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(DockerComposeUtils, 'dockerCompose', sinon.stub())
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
      const compose = DockerComposeUtils.dockerCompose as sinon.SinonStub;
      expect(compose.callCount).to.eq(2);
      expect(compose.firstCall.args[0][4]).to.deep.equal('NODE_ENV=dev');
      expect(compose.firstCall.args[0][6]).to.deep.equal('SSH_PUB_KEY="abc==\ntest.architect.io"');
    });
});
