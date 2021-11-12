import { expect } from '@oclif/test';
import { buildSpecFromYml, loadSourceYmlFromPathOrReject, transformComponentSpec } from '../../../src/dependency-manager/src';

describe('component transform unit test', function () {

  it(`transformComponentSpec successfully transforms spec without metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec);

    expect(config.services['api-db'].ref).to.equal('tests/superset/api-db:latest');
  });

  it(`transformComponentSpec successfully transforms spec with metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const metadata = {
      ref: 'examples/instance-1',
      tag: 'latest',
      instance_name: 'instance-1',
      instance_id: 'test-instance-id',
      instance_date: new Date(),
      interfaces: {}
    }
    const spec = buildSpecFromYml(source_yml);
    spec.metadata = metadata;
    const config = transformComponentSpec(spec);

    expect(config.services['api-db'].ref).to.equal('tests/superset/api-db:latest@instance-1');
  });
});
