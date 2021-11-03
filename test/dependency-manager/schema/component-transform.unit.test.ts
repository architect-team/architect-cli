import { expect } from '@oclif/test';
import { buildSpecFromYml, loadSourceYmlFromPathOrReject, Slugs, transformComponentSpec } from '../../../src/dependency-manager/src';

describe('component transform unit test', function () {

  it(`transformComponentSpec successfully transforms spec without instance_metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec, source_yml, Slugs.DEFAULT_TAG);

    expect(config.services['api-db'].ref).to.equal('tests/superset/api-db:latest');
  });

  it(`transformComponentSpec successfully transforms spec with instance_metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const instance_metadata = {
      instance_name: 'instance-1',
      instance_id: 'test-instance-id',
      instance_date: new Date(),
    }
    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec, source_yml, Slugs.DEFAULT_TAG, instance_metadata);

    expect(config.services['api-db'].ref).to.equal('tests/superset/api-db:latest@instance-1');
  });
});
