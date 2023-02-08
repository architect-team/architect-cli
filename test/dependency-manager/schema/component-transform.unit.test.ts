import { expect } from '@oclif/test';
import { buildSpecFromYml, ComponentInstanceMetadata, loadSourceYmlFromPathOrReject, transformComponentSpec } from '../../../src';

describe('component transform unit test', function () {

  it(`transformComponentSpec successfully transforms spec without metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec);

    expect(config.services['api-db'].metadata.ref).to.equal('superset.services.api-db');
  });

  it(`transformComponentSpec successfully transforms spec with metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);
    const ref = 'superset@instance-1';

    const metadata: ComponentInstanceMetadata = {
      ref,
      tag: 'latest',
      instance_name: 'instance-1',
      instance_id: 'test-instance-id',
      instance_date: new Date(),
      deprecated_interfaces_map: {}
    };
    const spec = buildSpecFromYml(source_yml, metadata);
    const config = transformComponentSpec(spec);

    expect(config.services['api-db'].metadata.ref).to.equal('superset.services.api-db@instance-1');
  });
});
