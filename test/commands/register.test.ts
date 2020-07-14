import { test } from '@oclif/test';
import { expect } from 'chai';
import sinon from 'sinon';
import * as docker from '../../src/common/utils/docker';
import { mockAuth } from '../utils/mocks';

describe('register', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  // we need to cast this as a string because annoyingly the oclif/test library has restricted this type to a string
  // while the underyling nock library that it wraps allows a regex
  const mock_api_host = (/.*/ as any as string);

  let dockerBuildStub: sinon.SinonStub;
  let dockerPushStub: sinon.SinonStub;
  let dockerInspectStub: sinon.SinonStub;

  const mock_accounts_response = {
    total: 1,
    rows: [
      {
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
    ]
  };

  test
    .do(ctx => mockAuth())
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['register', '--help'])
    .it('it succinctly describes the register command', ctx => {
      expect(ctx.stdout).to.contain('Register a new Component with Architect Cloud\n')
    });

  test
    .do(ctx => mockAuth())
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml', '-t', '1.0.0'])
    .it('it reports to the user that the component was registered successfully', ctx => {
      expect(ctx.stderr).to.contain('Successfully registered component');
    });

  test
    .do(ctx => {
      mockAuth();
      dockerBuildStub = sinon.stub(docker, "buildImage").returns(Promise.resolve('repostory/account/some-image:1.0.0'));
      dockerPushStub = sinon.stub(docker, "pushImage");
      dockerInspectStub = sinon.stub(docker, "getDigest").returns(Promise.resolve('some-digest'));
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml', '-t', '1.0.0'])
    .it('it does not call any docker commands if the image is provided', ctx => {
      expect(dockerBuildStub.notCalled).to.be.true;
      expect(dockerPushStub.notCalled).to.be.true;
      expect(dockerInspectStub.notCalled).to.be.true;

      expect(ctx.stderr).to.contain('Registering component examples/hello-world:1.0.0 with Architect Cloud');
      expect(ctx.stderr).to.contain('Successfully registered component');
    });

  test
    .do(ctx => mockAuth())
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml'])
    .it('it defaults the tag to latest if not supplied', ctx => {
      expect(ctx.stderr).to.contain('Registering component examples/hello-world:latest with Architect Cloud');
      expect(ctx.stderr).to.contain('Successfully registered component');
    });

  test
    .do(ctx => mockAuth())
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .get('/accounts')
      .reply(200, {
        total: 0,
        rows: []
      })
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml'])
    .catch(err => {
      expect(err.message).to.contain('You do not have access to the account specified in your component config: examples')
    })
    .it('rejects with informative error message if account is unavailable');

  test
    .do(ctx => {
      mockAuth();
      dockerBuildStub = sinon.stub(docker, "buildImage").returns(Promise.resolve('repostory/account/some-image:1.0.0'));
      dockerPushStub = sinon.stub(docker, "pushImage");
      dockerInspectStub = sinon.stub(docker, "getDigest").returns(Promise.resolve('some-digest'));
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .it('gives user feedback while running docker commands', ctx => {
      expect(dockerBuildStub.calledOnce).to.be.true;
      expect(dockerBuildStub.calledBefore(dockerPushStub)).to.be.true;
      expect(dockerPushStub.calledOnce).to.be.true;
      expect(dockerPushStub.calledBefore(dockerInspectStub)).to.be.true;
      expect(dockerInspectStub.calledOnce).to.be.true;

      expect(ctx.stderr).to.contain('Pushing Docker image for repostory/account/some-image:1.0.0');
      expect(ctx.stderr).to.contain('Successfully pushed Docker image for repostory/account/some-image:1.0.0');

      expect(ctx.stderr).to.contain('Running `docker inspect` on the given image: repostory/account/some-image:1.0.0');
      expect(ctx.stderr).to.contain('Image verified');

      expect(ctx.stderr).to.contain('Registering component examples/database-seeding:1.0.0 with Architect Cloud');
      expect(ctx.stderr).to.contain('Successfully registered component');
    });

  test
    .do(ctx => {
      mockAuth()
      dockerBuildStub = sinon.stub(docker, "buildImage").throws('Some internal docker build exception');
      dockerPushStub = sinon.stub(docker, "pushImage");
      dockerInspectStub = sinon.stub(docker, "getDigest").returns(Promise.resolve('some-digest'));
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .catch(err => {
      expect(err.message).to.contain('Some internal docker build exception')
    })
    .it('rejects with informative error message if docker build fails', ctx => {
      expect(dockerBuildStub.calledOnce).to.be.true;
      expect(dockerBuildStub.calledBefore(dockerPushStub)).to.be.true;
      expect(dockerPushStub.notCalled).to.be.true;
      expect(dockerInspectStub.notCalled).to.be.true;

      expect(ctx.stdout).to.contain('Docker build failed. If an image is not specified in your component spec, then a Dockerfile must be present');
    });

  test
    .do(ctx => {
      mockAuth();
      dockerBuildStub = sinon.stub(docker, "buildImage").returns(Promise.resolve('repostory/account/some-image:1.0.0'));
      dockerPushStub = sinon.stub(docker, "pushImage").throws('Some internal docker push exception');
      dockerInspectStub = sinon.stub(docker, "getDigest").returns(Promise.resolve('some-digest'));
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .catch(err => {
      expect(dockerBuildStub.calledOnce).to.be.true;
      expect(dockerBuildStub.calledBefore(dockerPushStub)).to.be.true;
      expect(dockerPushStub.calledOnce).to.be.true;
      expect(dockerPushStub.calledBefore(dockerInspectStub)).to.be.true;
      expect(dockerInspectStub.notCalled).to.be.true;

      expect(err.message).to.contain('Some internal docker push exception')
    })
    .it('rejects with informative error message if docker push fails', ctx => {
      expect(ctx.stderr).to.contain('Push failed for image repostory/account/some-image:1.0.0');
    });

  test
    .do(ctx => {
      mockAuth();
      dockerBuildStub = sinon.stub(docker, "buildImage").returns(Promise.resolve('repostory/account/some-image:1.0.0'));
      dockerPushStub = sinon.stub(docker, "pushImage");
      dockerInspectStub = sinon.stub(docker, "getDigest").throws('Some internal docker inspect exception')
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/database-seeding/architect.yml', '-t', '1.0.0'])
    .catch(err => {
      expect(dockerBuildStub.calledOnce).to.be.true;
      expect(dockerBuildStub.calledBefore(dockerPushStub)).to.be.true;
      expect(dockerPushStub.calledOnce).to.be.true;
      expect(dockerPushStub.calledBefore(dockerInspectStub)).to.be.true;
      expect(dockerInspectStub.calledOnce).to.be.true;

      expect(err.message).to.contain('Some internal docker inspect exception')
    })
    .it('rejects with informative error message if docker inspect fails');

  test
    .do(ctx => mockAuth())
    .finally(() => sinon.restore())
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-c', 'examples/hello-world/architect.yml', '-e', 'examples/stateless-component/environment.yml', '-t', '1.0.0'])
    .catch(err => {
      expect(err.message).to.contain('--environment= cannot also be provided when using --components=')
    })
    .it('it throws if both a component and an environment flag are provided; they are exclusive');

  test
    .do(ctx => {
      mockAuth()
      dockerBuildStub = sinon.stub(docker, "buildImage").returns(Promise.resolve('repostory/account/some-image:1.0.0'));
      dockerPushStub = sinon.stub(docker, "pushImage");
      dockerInspectStub = sinon.stub(docker, "getDigest").returns(Promise.resolve('some-digest'));
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get('/accounts')
      .reply(200, mock_accounts_response)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(/\/accounts\/.*\/components/)
      .reply(200, {})
    )
    .stdout({ print })
    .stderr({ print })
    .command(['register', '-e', 'examples/stateless-component/environment.yml', '-t', '1.0.0'])
    .it('gives user feedback for each component in the environment while running docker commands', ctx => {
      expect(dockerBuildStub.calledOnce).to.be.true; // there are two components but only one of them needs to build the docker image
      expect(dockerBuildStub.calledBefore(dockerPushStub)).to.be.true;
      expect(dockerPushStub.calledOnce).to.be.true;
      expect(dockerPushStub.calledBefore(dockerInspectStub)).to.be.true;
      expect(dockerInspectStub.calledOnce).to.be.true;

      expect(ctx.stderr).to.contain('Successfully pushed Docker image for repostory/account/some-image:1.0.0');
      expect(ctx.stderr).to.contain('Running `docker inspect` on the given image: repostory/account/some-image:1.0.0');

      expect(ctx.stderr).to.contain('Registering component examples/stateless-component:1.0.0 with Architect Cloud');
      expect(ctx.stderr).to.contain('Registering component examples/echo:1.0.0 with Architect Cloud');
    });
});
