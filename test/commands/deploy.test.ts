import {expect, test} from '@oclif/test';
import sinon from 'sinon';
import path from 'path';
import fs from 'fs-extra';
import Deploy from '../../src/commands/deploy';
import DockerComposeTemplate, { DockerService } from '../../src/common/docker-compose/template';

describe('deploy', () => {
  it('generates compose locally', async () => {
    const compose_spy = sinon.fake.resolves(null);
    sinon.replace(Deploy.prototype, 'runCompose', compose_spy);

    const division_service_path = path.join(__dirname, '../calculator/division-service');
    await Deploy.run(['-l', '-s', division_service_path]);

    const expected_compose = fs.readJSONSync(path.join(__dirname, '../mocks/calculator-compose.json')) as DockerComposeTemplate;
    expect(compose_spy.calledOnce).to.equal(true);

    const input_tpl = compose_spy.firstCall.args[0];
    expect(input_tpl.version).to.equal(expected_compose.version);
    for (const key of Object.keys(input_tpl.services)) {
      expect(Object.keys(expected_compose.services)).to.include(key);

      const input = input_tpl.services[key] as DockerService;
      const expected = expected_compose.services[key];
      expect(expected.ports).to.have.members(input.ports);
      expect(expected.image).to.equal(input.image);
      expect(expected.depends_on).to.have.members(input.depends_on);
      expect(expected.build).to.eql(input.build);
      expect(expected.command).to.equal(input.command);
      expect(expected.environment).to.eql(input.environment);
    }
  });
});
