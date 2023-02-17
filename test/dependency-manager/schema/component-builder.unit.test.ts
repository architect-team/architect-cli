import { expect } from '@oclif/test';
import path from 'path';
import { buildConfigFromYml, loadSourceYmlFromPathOrReject, parseSourceYml, Slugs } from '../../../src';

describe('component builder unit test', function () {

  it(`loadSourceYmlFromPathOrReject loads valid file`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    expect(source_path).to.equal(path.resolve(`test/mocks/superset/architect.yml`));
    expect(source_yml).to.contain('name: superset');
  });

  it(`loadSourceYmlFromPathOrReject loads valid directory`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset`);

    expect(source_path).to.equal(path.resolve(`test${path.sep}mocks${path.sep}superset${path.sep}architect.yml`));
    expect(source_yml).to.contain('name: superset');
  });

  it(`loadSourceYmlFromPathOrReject throws if given invalid directory`, async () => {
    expect(() => loadSourceYmlFromPathOrReject(`/non-existant/directory`)).to.throw('Could not find architect.yml at /non-existant/directory');
  });

  it(`parseSourceYml parses yaml into object with blank fields set to null`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const parsed_yml = parseSourceYml(source_yml);

    expect((parsed_yml as any).name).to.equal('superset');
    expect((parsed_yml as any).secrets.param_unset).to.be.null; // checks and makes sure we're properly parsing empty keys to 'null'
  });

  it(`buildConfigFromYml parses yaml and builds into config`, async () => {
    const { source_path, source_yml } = loadSourceYmlFromPathOrReject(`test/mocks/superset/architect.yml`);

    const config = buildConfigFromYml(source_yml);

    expect(config.name).to.equal('superset');
    expect(config.metadata.tag).to.equal(Slugs.DEFAULT_TAG);
  });

});
