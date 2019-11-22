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

    const calculator_env_config_path = path.join(__dirname, '../calculator/arc.env.json');
    await Deploy.run(['-l', calculator_env_config_path]);

    const expected_compose = fs.readJSONSync(path.join(__dirname, '../mocks/calculator-compose.json')) as DockerComposeTemplate;
    expect(compose_spy.calledOnce).to.equal(true);

    expect(compose_spy.firstCall.args[0].version).to.equal(expected_compose.version);
    for (const key of Object.keys(compose_spy.firstCall.args[0].services)) {
      expect(Object.keys(expected_compose.services)).to.include(key);

      const input = compose_spy.firstCall.args[0].services[key] as DockerService;
      const expected = expected_compose.services[key];

      // Overwrite expected paths with full directories
      if (expected.build) {
        expected.build.context = path.join(__dirname, '../../', expected.build.context);
      }

      if (expected.volumes) {
        expected.volumes = expected.volumes.map(volume => {
          const [host, target] = volume.split(':');
          return `${path.join(__dirname, '../../', host)}:${target}`;
        });
      }

      expect(expected.ports).to.have.members(input.ports);
      expect(expected.image).to.equal(input.image);
      expect(expected.depends_on).to.have.members(input.depends_on);
      expect(expected.build).to.eql(input.build);
      expect(expected.command).to.equal(input.command);
      expect(input.environment).not.to.be.undefined;

      // Test env variables
      for (const [key, value] of Object.entries(expected.environment || {})) {
        if (key === 'ARCHITECT') {
          const architect_input = JSON.parse(input.environment![key]);
          const architect_expected = JSON.parse(value);
          expect(architect_expected).to.eql(architect_input);
        } else {
          expect(value).to.equal(input.environment![key]);
        }
      }
    }
  });
});
