import { expect } from '@oclif/test';
import { buildSpecFromYml, loadSourceYmlFromPathOrReject, transformComponentSpec } from '../../../src/dependency-manager/src';

describe('component transform unit test', function () {

  it(`transformComponentSpec successfully transforms spec without metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const spec = buildSpecFromYml(source_yml);
    const config = transformComponentSpec(spec);

    expect(config.services['api-db'].ref).to.equal('tests/superset.services.api-db');
  });

  it(`transformComponentSpec successfully transforms spec with metadata`, async () => {
    const { source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const metadata = {
      name: 'superset',
      ref: 'tests/superset',
      tag: 'latest',
      instance_name: 'instance-1',
      instance_id: 'test-instance-id',
      instance_date: new Date(),
      interfaces: {},
      proxy_port_mapping: {}
    }
    const spec = buildSpecFromYml(source_yml);
    spec.metadata = metadata;
    const config = transformComponentSpec(spec);

    expect(config.services['api-db'].ref).to.equal('tests/superset.services.api-db@instance-1');
  });
});
