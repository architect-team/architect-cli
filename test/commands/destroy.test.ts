import { test } from '@oclif/test';
import { expect } from 'chai';
import sinon from 'sinon';
import { DeployCommand } from '../../src/commands/deploy';
import { mockAuth } from '../utils/mocks';

describe('destroy', function () {

  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const mock_api_host = (/.*/ as any as string);

  const mock_account = {
    id: 'test-id',
    name: 'test-account'
  }

  const mock_env = {
    id: 'test-id',
    name: 'test-env'
  }

  const mock_deployment = {
    id: 'test-id'
  }

  test
    .do(ctx => {
      mockAuth()
      sinon.replace(DeployCommand, 'POLL_INTERVAL', 0);
    })
    .finally(() => sinon.restore())
    .nock(mock_api_host, api => api
      .persist()
      .get(`/accounts/${mock_account.name}`)
      .reply(200, mock_account)
    )
    .nock(mock_api_host, api => api
      .persist()
      .get(`/accounts/${mock_account.id}/environments/${mock_env.name}`)
      .reply(200, mock_env)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(`/environments/${mock_env.id}/deploy`)
      .reply(200, mock_deployment)
    )
    .nock(mock_api_host, api => api
      .persist()
      .post(`/deploy/${mock_deployment.id}?lock=true&refresh=true`)
      .reply(200, {})
    )
    .nock(mock_api_host, api => api
      .persist()
      .get(`/deploy/${mock_deployment.id}`)
      .reply(200, { ...mock_deployment, applied_at: new Date() })
    )
    .stdout({ print })
    .stderr({ print })
    .timeout(20000)
    .command(['destroy', '-a', mock_account.name, '-e', mock_env.name, '--auto_approve'])
    .it('destroy completes', ctx => {
      expect(ctx.stdout).to.contain('Deployed\n')
    });
});
