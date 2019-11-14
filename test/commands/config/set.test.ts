import {expect} from '@oclif/test';
import sinon from 'sinon';
import fs from 'fs-extra';
import ConfigSet from '../../../src/commands/config/set';
import AppConfig from '../../../src/app-config/config';
import InvalidConfigOption from '../../../src/common/errors/invalid-config-option';

const verifyConfigField = async (key: string, value: string) => {
  const logStub = sinon.fake.returns(null);
  const saveSpy = sinon.fake.returns(null);
  sinon.replace(fs, 'writeJSONSync', saveSpy);
  sinon.replace(ConfigSet.prototype, 'log', logStub);

  await ConfigSet.run([key, value]);
  expect(saveSpy.calledOnce).to.equal(true);
  expect(saveSpy.firstCall.args[1][key]).to.equal(value);

  sinon.restore();
};

describe('config:set', function() {
  afterEach(function() {
    sinon.restore();
  });

  it('should fail for bad key', async () => {
    const spy = sinon.fake.returns(null);
    sinon.replace(ConfigSet.prototype, 'catch', spy);

    const fake_option = 'invalid_option';
    const expected_error = new InvalidConfigOption(fake_option);

    await ConfigSet.run([fake_option, 'test-value']);
    expect(spy.calledOnce).to.equal(true);
    expect(spy.firstCall.args[0].name).to.equal(expected_error.name);
    expect(spy.firstCall.args[0].message).to.equal(expected_error.message);
  });

  it('should save config changes', async () => {
    const config = new AppConfig('', {
      api_host: 'https://api.architect.test',
      registry_host: 'registry.architect.test',
      log_level: 'test',
    });

    await verifyConfigField('log_level', config.log_level);
    await verifyConfigField('registry_host', config.registry_host);
    await verifyConfigField('api_host', config.api_host);
    await verifyConfigField('oauth_domain', config.oauth_domain);
    await verifyConfigField('oauth_client_id', config.oauth_client_id);
  });
})
