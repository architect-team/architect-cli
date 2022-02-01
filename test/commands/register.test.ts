import { expect } from 'chai';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import sinon from 'sinon';
import ComponentRegister from '../../src/commands/register';
import * as Docker from '../../src/common/utils/docker';
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
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_architect_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0')
        expect(body.config.name).to.eq('examples/fusionauth')
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
    .command(['register', '-c', 'examples/fusionauth/architect.yml', '-t', '1.0.0'])
    .it('test file: replacement', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(buildImage.notCalled).to.be.true;
      expect(pushImage.notCalled).to.be.true;
      expect(getDigest.notCalled).to.be.true;

      expect(ctx.stderr).to.contain('Registering component examples/fusionauth:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stdout({ print })
    .stderr({ print })
    .command(['register', '--help'])
    .it('it succinctly describes the register command', ctx => {
      expect(ctx.stdout).to.contain('Register a new Component with Architect Cloud\n')
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => body)
      .reply(200, (uri, body: any, cb) => {
        const contents = yaml.load(fs.readFileSync('examples/hello-world/architect.yml').toString());
        expect(body.config).to.deep.equal(contents);
        cb(null, body)
      })
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/hello-world/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml', '-t', '1.0.0'])
    .it('it reports to the user that the component was registered successfully', ctx => {
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0')
        expect(body.config.name).to.eq('examples/hello-world')
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
    .command(['register', '-c', 'examples/hello-world/architect.yml', '-t', '1.0.0'])
    .it('it does not call any docker commands if the image is provided', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(buildImage.notCalled).to.be.true;
      expect(pushImage.notCalled).to.be.true;
      expect(getDigest.notCalled).to.be.true;

      expect(ctx.stderr).to.contain('Registering component examples/hello-world:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
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
    .command(['register', '-c', 'examples/hello-world/architect.yml'])
    .it('it defaults the tag to latest if not supplied', ctx => {
      expect(ctx.stderr).to.contain('Registering component examples/hello-world:latest with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .nock(MOCK_API_HOST, api => api
      .get('/accounts/examples')
      .reply(403, {
        message: 'Friendly error message from server'
      })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml'])
    .catch(err => {
      expect(err.message).to.contain('Friendly error message from server')
    })
    .it('rejects with informative error message if account is unavailable');

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/, (body) => {
        expect(body.tag).to.eq('1.0.0')
        expect(body.config.name).to.eq('examples/database-seeding')
        expect(body.config.services.app.image).to.eq('repostory/account/some-image@some-digest')
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
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .it('gives user feedback while running docker commands', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;

      expect(buildImage.calledOnce).to.be.true;
      expect(buildImage.calledBefore(pushImage)).to.be.true;
      expect(pushImage.calledTwice).to.be.true;
      expect(pushImage.calledBefore(getDigest)).to.be.true;
      expect(getDigest.calledOnce).to.be.true;

      expect(ctx.stderr).to.contain('Pushing Docker image for repostory/account/some-image:1.0.0');
      expect(ctx.stdout).to.contain('Successfully pushed Docker image for repostory/account/some-image:1.0.0');

      expect(ctx.stderr).to.contain('Running `docker inspect` on the given image: repostory/account/some-image:1.0.0');
      expect(ctx.stdout).to.contain('Image verified');

      expect(ctx.stderr).to.contain('Registering component examples/database-seeding:1.0.0 with Architect Cloud');
      expect(ctx.stdout).to.contain('Successfully registered component');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().throws('Some internal docker build exception'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .catch(err => {
      expect(err.message).to.contain('Some internal docker build exception')
    })
    .it('rejects with informative error message if docker build fails', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;

      expect(buildImage.calledOnce).to.be.true;
      expect(buildImage.calledBefore(pushImage)).to.be.true;
      expect(pushImage.notCalled).to.be.true;
      expect(getDigest.notCalled).to.be.true;

      expect(ctx.stdout).to.contain('Docker build failed. If an image is not specified in your component spec, then a Dockerfile must be present');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().throws('Some internal docker push exception'))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .catch(err => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(buildImage.calledOnce).to.be.true;
      expect(buildImage.calledBefore(pushImage)).to.be.true;
      expect(pushImage.calledOnce).to.be.true;
      expect(pushImage.calledBefore(getDigest)).to.be.true;
      expect(getDigest.notCalled).to.be.true;

      expect(err.message).to.contain('Some internal docker push exception')
    })
    .it('rejects with informative error message if docker push fails', ctx => {
      expect(ctx.stderr).to.contain('Push failed for image repostory/account/some-image:1.0.0');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().throws('Some internal docker inspect exception'))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .catch(err => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(buildImage.calledOnce).to.be.true;
      expect(buildImage.calledBefore(pushImage)).to.be.true;
      expect(pushImage.calledTwice).to.be.true;
      expect(pushImage.calledBefore(getDigest)).to.be.true;
      expect(getDigest.calledOnce).to.be.true;

      expect(err.toString()).to.contain('Some internal docker inspect exception')
    })
    .it('rejects with informative error message if docker inspect fails');

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
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
    .command(['register', 'examples/stateless-component/architect.yml', '-t', '1.0.0'])
    .it('gives user feedback for each component in the environment while running docker commands', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      const pushImage = Docker.pushImage as sinon.SinonStub;
      const getDigest = Docker.getDigest as sinon.SinonStub;
      expect(buildImage.calledOnce).to.be.true; // there are two components but only one of them needs to build the docker image
      expect(buildImage.calledBefore(pushImage)).to.be.true;
      expect(pushImage.calledTwice).to.be.true;
      expect(pushImage.calledBefore(getDigest)).to.be.true;
      expect(getDigest.calledOnce).to.be.true;

      expect(ctx.stdout).to.contain('Successfully pushed Docker image for repostory/account/some-image:1.0.0');
      expect(ctx.stderr).to.contain('Running `docker inspect` on the given image: repostory/account/some-image:1.0.0');

      expect(ctx.stderr).to.contain('Registering component examples/stateless-component:1.0.0 with Architect Cloud');
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/examples/components/database-seeding/versions/1.0.0`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .it('docker image built with dockerfile specified in architect.yml', ctx => {
      const current_path = path.join(__dirname, '../..').replace(/\/$/gi, '').replace(/\\$/gi, '').toLowerCase();
      const buildImage = Docker.buildImage as sinon.SinonStub;
      expect(buildImage.args[0][0].toLowerCase()).to.eq(path.join(current_path, 'examples/database-seeding'));
      expect(buildImage.args[0][2].toLowerCase()).to.eq(path.join(current_path, 'examples/database-seeding/dockerfile'));
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
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
    .command(['register', 'examples/react-app/architect.yml', '--arg', 'NODE_ENV=dev'])
    .it('override build arg specified in architect.yml', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      expect(buildImage.callCount).to.eq(2);
      expect(buildImage.firstCall.args[3]).to.deep.equal(['NODE_ENV=dev']);
      expect(buildImage.firstCall.lastArg).undefined;
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
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
    .command(['register', 'examples/stateful-component/architect.yml', '--arg', 'NODE_ENV=dev', '--arg', 'SSH_PUB_KEY="abc==\ntest.architect.io"'])
    .it('set build arg not specified in architect.yml', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      expect(buildImage.callCount).to.eq(2);
      expect(buildImage.firstCall.args[3]).to.deep.equal(['NODE_ENV=dev', 'SSH_PUB_KEY="abc==\ntest.architect.io"']);
      expect(buildImage.firstCall.lastArg).undefined;
    });

  mockArchitectAuth
    .stub(Docker, 'verify', sinon.stub().returns(Promise.resolve()))
    .stub(Docker, 'buildImage', sinon.stub().returns('repostory/account/some-image:1.0.0'))
    .stub(Docker, 'pushImage', sinon.stub().returns(undefined))
    .stub(Docker, 'getDigest', sinon.stub().returns(Promise.resolve('some-digest')))
    .stub(Docker, 'imageExists', sinon.stub().returns(Promise.resolve(false)))
    .stub(fs, 'copySync', sinon.stub().returns(Promise.resolve(true)))
    .stub(ComponentRegister.prototype, 'pushArtifact', sinon.stub().returns(Promise.resolve(true)))
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/tests`)
      .reply(200, mock_account_response)
    )
    .nock(MOCK_API_HOST, api => api
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/tests/components/superset/versions/latest`)
      .reply(200)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', path.join(__dirname, `../mocks/superset/architect.yml`)])
    .it('set build target for docker build', ctx => {
      const buildImage = Docker.buildImage as sinon.SinonStub;
      expect(buildImage.callCount).to.eq(2);
      expect(buildImage.firstCall.lastArg).to.eq('production');
    });
});
