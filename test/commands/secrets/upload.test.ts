import { expect } from '@oclif/test';
import sinon from 'sinon';
import SecretUtils from '../../../src/architect/secret/secret.utils';
import UserUtils from '../../../src/architect/user/user.utils';
import { mockArchitectAuth, MOCK_API_HOST } from '../../utils/mocks';

describe('secrets', function () {
  // set to true while working on tests for easier debugging; otherwise oclif/test eats the stdout/stderr
  const print = false;

  const account = {
    id: "aa440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples"
  }

  const defaults = mockArchitectAuth()
    .nock(MOCK_API_HOST, api => api
      .get(`/accounts/${account.name}`)
      .reply(200, account));

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', './test/mocks/secrets/account-secrets.yml'])
    .it('upload account secrets successfully', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '--override', './test/mocks/secrets/account-secrets.yml'])
    .it('upload account secrets successfully with override', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '--platform', 'my-platform', '-e', 'env', './test/mocks/secrets/platform-secrets.yml'])
    .catch(ctx => {
      expect(ctx.message).to.contain('Please provide either the platform flag or the environment flag and not both.')
    })
    .it('upload secrets failed when both platform and environment flags are set');

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '--platform', 'my-platform', './test/mocks/secrets/platform-secrets.yml'])
    .it('upload platform secrets successfully', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '-e', 'env', './test/mocks/secrets/environment-secrets.yml'])
    .it('upload environment secrets successfully', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', '-e', 'env', '--override', './test/mocks/secrets/environment-secrets.yml'])
    .it('upload environment secrets successfully with override', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  defaults
    .stub(UserUtils, 'isAdmin', async () => false)
    .stdout({ print })
    .stderr({ print })
    .command(['secrets:set', '-a', 'examples', './test/mocks/secrets/account-secrets.yml'])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to upload secrets')
    })
    .it('upload account secrets failed due to permission');
});
