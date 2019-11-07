import {expect} from '@oclif/test';
import sinon from 'sinon';
import fs from 'fs-extra';
import AppService from '../../../src/app-config/service';
import ConfigSet from '../../../src/commands/config/set';
import AppConfig from '../../../src/app-config/config';
import InvalidConfigOption from '../../../src/common/errors/invalid-config-option';

describe('config:set', function() {
  this.timeout(25000);

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
    const config = new AppConfig({
      api_host: 'https://api.architect.test',
      registry_host: 'registry.architect.test',
      log_level: 'test',
    });

    for (const key of Object.keys(config)) {
      const logStub = sinon.fake.returns(null);
      const saveSpy = sinon.fake.returns(null);
      sinon.replace(fs, 'writeFileSync', saveSpy);
      sinon.replace(ConfigSet.prototype, 'log', logStub);

      await ConfigSet.run([key, config[key]]);
      expect(saveSpy.calledOnce).to.equal(true);
      expect(JSON.parse(saveSpy.firstCall.args[1])[key]).to.equal(config[key]);

      sinon.restore();
    }
  });
})
