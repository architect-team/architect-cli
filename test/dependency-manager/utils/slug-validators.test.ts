import { expect } from 'chai';
import { Slugs } from '../../../src/dependency-manager/src/utils/slugs';

describe('slugs validators', () => {

  const valid_slug = 'architect';
  const invalid_slug = 'double--dashes';
  const valid_tag = '1.0.0';
  const invalid_tag = '.1.0.0';

  const valid_slugs = [
    valid_slug,
    'arc-examples',
    'arc-examples-2',
    '2-arc-examples',
    'something-24-chars-loong',
    'a',
    '2',
  ];

  const valid_tags = [
    valid_tag,
    '1-0-0',
    '1',
    'latest',
  ]

  const globally_invalid_punctuation = [
    'other?punctuation',
    'other/punctuation',
    'other_punctuation',
    'other|punctuation',
    'other\'punctuation',
    'other"punctuation',
    'other]punctuation',
    'other[punctuation',
    'other{punctuation',
    'other}punctuation',
    'other=punctuation',
    'other+punctuation',
    'other>punctuation',
    'other<punctuation',
    'other(punctuation',
    'other)punctuation',
    'other*punctuation',
    'other^punctuation',
    'other%punctuation',
    'other@punctuation',
    'other~punctuation',
    'other`punctuation',
    'other,punctuation',
    'other&punctuation',
    'other$punctuation',
    'other#punctuation',
    'other!punctuation',
    'other;punctuation',
  ];

  const invalid_slugs = [
    invalid_slug,
    '-leading-dashes',
    'trailingdashes-',
    'something-25-chars-looong',
    'other.punctuation',
    ...globally_invalid_punctuation
  ];

  const invalid_tags = [
    invalid_tag,
    '-1',
    'double..periods',
    'double--dashes',
    ...globally_invalid_punctuation,
  ]

  it(`valid slugs are acceptable to ArchitectSlugValidator`, async () => {
    for (const slug of valid_slugs) {
      expect(Slugs.ArchitectSlugValidator.test(slug)).to.be.true
    }
  });

  it(`valid slugs are NOT acceptable to ArchitectSlugValidator`, async () => {
    for (const slug of invalid_slugs) {
      expect(Slugs.ArchitectSlugValidator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ComponentTagValidator`, async () => {
    for (const tag of valid_tags) {
      expect(Slugs.ComponentTagValidator.test(tag)).to.be.true
    }
  });

  it(`valid slugs are NOT acceptable to ComponentTagValidator`, async () => {
    for (const tag of invalid_tags) {
      expect(Slugs.ComponentTagValidator.test(tag)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ComponentSlugValidator`, async () => {
    for (const component_name of valid_slugs) {
      const slug = `${valid_slug}/${component_name}`;
      expect(Slugs.ComponentSlugValidator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ComponentSlugValidator`, async () => {
    for (const component_name of invalid_slugs) {
      const slug = `${valid_slug}/${component_name}`;
      expect(Slugs.ComponentSlugValidator.test(slug)).to.be.false
    }

    for (const component_name of valid_slugs) {
      const slug = `${invalid_slug}/${component_name}`;
      expect(Slugs.ComponentSlugValidator.test(slug)).to.be.false
    }

    for (const component_name of invalid_slugs) {
      const slug = `${invalid_slug}/${component_name}`;
      expect(Slugs.ComponentSlugValidator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ComponentVersionSlugValidator`, async () => {
    for (const tag of valid_tags) {
      const slug = `${valid_slug}/${valid_slug}:${tag}`;
      expect(Slugs.ComponentVersionSlugValidator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ComponentVersionSlugValidator`, async () => {
    for (const tag of valid_tags) {
      const slug = `${invalid_slug}/${valid_slug}:${tag}`;
      expect(Slugs.ComponentVersionSlugValidator.test(slug)).to.be.false
    }

    for (const tag of valid_tags) {
      const slug = `${valid_slug}/${invalid_slug}:${tag}`;
      expect(Slugs.ComponentVersionSlugValidator.test(slug)).to.be.false
    }

    for (const tag of invalid_tags) {
      const slug = `${valid_slug}/${valid_slug}:${tag}`;
      expect(Slugs.ComponentVersionSlugValidator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ServiceSlugValidator`, async () => {
    for (const resource_name of valid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${resource_name}`;
      expect(Slugs.ServiceSlugValidator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ServiceSlugValidator`, async () => {
    for (const resource_name of invalid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${resource_name}`;
      expect(Slugs.ServiceSlugValidator.test(slug)).to.be.false
    }

    for (const component_name of invalid_slugs) {
      const slug = `${valid_slug}/${component_name}/${valid_slug}`;
      expect(Slugs.ServiceSlugValidator.test(slug)).to.be.false
    }

    for (const account_name of invalid_slugs) {
      const slug = `${account_name}/${valid_slug}/${valid_slug}`;
      expect(Slugs.ServiceSlugValidator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ServiceVersionSlugValidator`, async () => {
    for (const resource_name of valid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${resource_name}:${valid_tag}`;
      expect(Slugs.ServiceVersionSlugValidator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ServiceVersionSlugValidator`, async () => {
    for (const resource_name of invalid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${resource_name}:${valid_tag}`;
      expect(Slugs.ServiceVersionSlugValidator.test(slug)).to.be.false
    }

    for (const component_name of invalid_slugs) {
      const slug = `${valid_slug}/${component_name}/${valid_slug}:${valid_tag}`;
      expect(Slugs.ServiceVersionSlugValidator.test(slug)).to.be.false
    }

    for (const account_name of invalid_slugs) {
      const slug = `${account_name}/${valid_slug}/${valid_slug}:${valid_tag}`;
      expect(Slugs.ServiceVersionSlugValidator.test(slug)).to.be.false
    }
  });

  it(`valid slugs are acceptable to ServiceInstanceSlugValidator`, async () => {
    for (const account_environment_name of valid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${valid_slug}:${valid_tag}@${account_environment_name}/${valid_slug}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.true
    }
  });

  it(`invalid slugs are NOT acceptable to ServiceInstanceSlugValidator`, async () => {
    for (const account_environment_name of invalid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${valid_slug}:${valid_tag}@${account_environment_name}/${valid_slug}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.false
    }

    for (const tag of invalid_tags) {
      const slug = `${valid_slug}/${valid_slug}/${valid_slug}:${tag}@${valid_slug}/${valid_slug}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.false
    }

    for (const environment_name of invalid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${valid_slug}:${valid_tag}@${valid_slug}/${environment_name}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.false
    }

    for (const resource_name of invalid_slugs) {
      const slug = `${valid_slug}/${valid_slug}/${resource_name}:${valid_tag}@${valid_slug}/${valid_slug}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.false
    }

    for (const component_name of invalid_slugs) {
      const slug = `${valid_slug}/${component_name}/${valid_slug}:${valid_tag}@${valid_slug}/${valid_slug}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.false
    }

    for (const account_name of invalid_slugs) {
      const slug = `${account_name}/${valid_slug}/${valid_slug}:${valid_tag}@${valid_slug}/${valid_slug}`;
      expect(Slugs.ServiceInstanceSlugValidator.test(slug)).to.be.false
    }
  });
});
