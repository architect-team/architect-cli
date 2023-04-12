import { expect } from '@oclif/test';
import sinon from 'sinon';
import SecretUtils from '../../../src/architect/secret/secret.utils';
import UserUtils from '../../../src/architect/user/user.utils';
import { MockArchitectApi } from '../../utils/mocks';

describe('secrets', function () {
  const account = {
    id: "aa440d39-97d9-43c3-9f1a-a9a69adb2a41",
    name: "examples"
  }

  new MockArchitectApi()
    .getAccount(account)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .command(['secrets:set', '-a', 'examples', './test/mocks/secrets/account-secrets.yml'])
    .it('upload account secrets successfully', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getTests()    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .command(['secrets:set', '-a', 'examples', '--override', './test/mocks/secrets/account-secrets.yml'])
    .it('upload account secrets successfully with override', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getTests()    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .command(['secrets:set', '-a', 'examples', '--cluster', 'my-cluster', '-e', 'env', './test/mocks/secrets/cluster-secrets.yml'])
    .catch(ctx => {
      expect(ctx.message).to.contain('Please provide either the cluster flag or the environment flag and not both.')
    })
    .it('upload secrets failed when both cluster and environment flags are set');

  new MockArchitectApi()
    .getAccount(account)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .command(['secrets:set', '-a', 'examples', '--cluster', 'my-cluster', './test/mocks/secrets/cluster-secrets.yml'])
    .it('upload cluster secrets successfully', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .command(['secrets:set', '-a', 'examples', '-e', 'env', './test/mocks/secrets/environment-secrets.yml'])
    .it('upload environment secrets successfully', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => true)
    .stub(SecretUtils, 'getSecrets', sinon.stub())
    .stub(SecretUtils, 'batchUpdateSecrets', sinon.stub())
    .command(['secrets:set', '-a', 'examples', '-e', 'env', '--override', './test/mocks/secrets/environment-secrets.yml'])
    .it('upload environment secrets successfully with override', ctx => {
      const batch_update = SecretUtils.batchUpdateSecrets as sinon.SinonStub;
      expect(batch_update.callCount).to.eq(1);
      expect(ctx.stdout).to.contain('Successfully uploaded secrets');
    })

  new MockArchitectApi()
    .getAccount(account)
    .getTests()
    .stub(UserUtils, 'isAdmin', async () => false)
    .command(['secrets:set', '-a', 'examples', './test/mocks/secrets/account-secrets.yml'])
    .catch(ctx => {
      expect(ctx.message).to.contain('You do not have permission to upload secrets')
    })
    .it('upload account secrets failed due to permission');
});
